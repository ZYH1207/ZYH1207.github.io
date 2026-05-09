---
title: Redisson 分布式锁全解析：从单锁到 MultiLock
author: Cole
tags:
  - Java
  - Redis
categories: 开发
cover: fm.png
description: Redisson 分布式锁全解析：从单锁到 MultiLock
date: 2026-05-09 11:15:10
---



## 一、Redisson基础分布式锁：从流程图看核心原理
Redisson的基础分布式锁`RLock`，是业界实现Redis分布式锁的标杆方案，它解决了原生`SETNX`锁的原子性、续期、重入等问题。我们先从经典的锁流程图，拆解其获取与释放的完整逻辑。

### 1.1 锁的获取流程
Redisson的加锁逻辑通过**原子Lua脚本**保证操作的原子性，避免并发场景下的竞态问题，整个流程可分为「加锁成功」和「加锁失败等待」两个分支：

#### 分支1：加锁成功（TTL为null）
当客户端尝试获取锁时，Lua脚本会检查锁对应的Redis Key：
- 若Key不存在：直接创建锁（采用Hash结构存储，Key为锁名，Field为「客户端ID:线程ID」，Value为重入次数），并设置初始过期时间；
- 若Key存在且为当前线程持有：重入次数+1，返回`null`表示加锁成功。

此时会根据用户设置的`leaseTime`（锁持有超时时间）做分支判断：
- 若`leaseTime != -1`：表示用户手动指定了锁超时时间，直接返回`true`，锁会在超时后自动释放；
- 若`leaseTime == -1`（Redisson默认场景）：开启**WatchDog看门狗机制**，由后台定时线程为锁续期，避免业务未执行完锁就提前过期。

#### 分支2：加锁失败（TTL不为null）
若锁已被其他线程持有，Lua脚本会返回锁的剩余存活时间（TTL），此时进入等待流程：
1.  判断剩余等待时间是否大于0：若用户设置的`waitTime`（最大等待时间）已耗尽，直接返回`false`，加锁失败；
2.  订阅锁释放信号：客户端通过Redis的**Pub/Sub机制**订阅锁对应的释放消息通道，避免无效轮询；
3.  等待信号或超时：若收到锁释放信号且未超时，回到「尝试获取锁」步骤重新竞争；若等待超时仍未收到信号，返回`false`。

### 1.2 锁的释放流程
锁的释放同样通过原子Lua脚本保证原子性，流程清晰且兼顾异常场景：
1.  尝试释放锁：检查锁是否存在、是否为当前线程持有，若不匹配则抛出异常；
2.  处理重入次数：若锁为当前线程持有，重入次数-1，减为0则删除锁；
3.  通知等待线程：释放成功后，向锁对应的Pub/Sub通道发送「锁释放消息」，通知等待的线程重新竞争；
4.  取消看门狗：若开启了WatchDog续期，终止定时任务，避免无效续期；
5.  异常处理：若释放失败（如锁已过期、不属于当前线程），记录异常并结束流程。

### 1.3 三大核心机制拆解
Redisson锁的可靠性，离不开这三个关键设计：
| 机制 | 核心作用 |
| :--- | :--- |
| **可重入锁** | 基于Hash结构实现，同一线程可多次加锁，重入次数匹配后才会真正释放锁，避免死锁 |
| **WatchDog看门狗** | 默认每10秒（锁过期时间的1/3）续期一次，只要客户端存活就持续重置锁过期时间；客户端宕机则锁会在30秒后自动过期，兼顾业务连续性与死锁避免 |
| **Pub/Sub等待** | 避免等待线程轮询Redis，锁释放时主动通知，大幅降低Redis压力，减少无效等待 |

---

## 二、Redisson MultiLock：多资源原子锁的解决方案
基础`RLock`仅支持单个资源的加锁，当业务需要同时操作多个独立资源（如订单、库存、支付），且必须保证「要么所有资源都锁住，要么都不锁」时，就需要用到Redisson提供的`MultiLock`。

### 2.1 MultiLock是什么？解决什么问题？
`MultiLock`是Redisson提供的**多锁聚合器**，它可以将多个独立的`RLock`合并为一个逻辑上的锁，实现「所有子锁都获取成功，才算加锁成功；释放时必须释放所有子锁」的原子性语义。

它主要服务于两类场景：
1.  **多资源原子性加锁**：避免部分资源加锁成功、部分失败导致的数据不一致；
2.  **跨多Redis节点锁聚合**：可将不同Redis实例/集群上的锁合并为一个逻辑锁，是RedissonRedLock的基础组件。

⚠️ 关键区分：`MultiLock`本身不是RedLock算法，它不具备节点故障容错性，必须所有子锁都获取成功才算成功；而`RedissonRedLock`基于RedLock算法，只要超过半数节点加锁成功，整体就算成功。

### 2.2 核心特性一览
- **原子性加锁/回滚**：加锁时按顺序获取子锁，任意子锁失败则立刻释放所有已获取的锁，避免「孤儿锁」；
- **顺序性约束**：加锁/释放时按固定顺序操作，需保证所有客户端加锁顺序一致，否则可能引发死锁；
- **可重入性**：每个子锁支持重入，`MultiLock`整体也支持同一线程多次加锁；
- **WatchDog支持**：默认模式下会为所有子锁开启看门狗续期，与业务执行生命周期绑定；
- **跨实例兼容**：子锁可来自同一个或不同的RedissonClient实例。

### 2.3 基础使用示例
```java
import org.redisson.Redisson;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.redisson.api.RedissonMultiLock;

public class MultiLockExample {
    public static void main(String[] args) {
        // 1. 初始化多个Redisson客户端（可同实例/跨实例）
        Config config1 = new Config();
        config1.useSingleServerConfig().setAddress("redis://127.0.0.1:6379");
        RedissonClient client1 = Redisson.create(config1);

        Config config2 = new Config();
        config2.useSingleServerConfig().setAddress("redis://127.0.0.1:6380");
        RedissonClient client2 = Redisson.create(config2);

        // 2. 获取多个独立锁对象
        RLock orderLock = client1.getLock("resource:order:1001");
        RLock stockLock = client2.getLock("resource:stock:2001");

        // 3. 构建MultiLock
        RedissonMultiLock multiLock = new RedissonMultiLock(orderLock, stockLock);

        try {
            // 4. 加锁：设置总等待时间10秒，锁持有时间30秒
            boolean locked = multiLock.tryLock(10, 30, java.util.concurrent.TimeUnit.SECONDS);
            if (locked) {
                // 业务逻辑：同时操作订单+库存资源
                System.out.println("MultiLock获取成功，执行业务逻辑");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            // 5. 释放锁：逆序释放所有子锁，即使部分失败也会继续执行
            multiLock.unlock();
        }

        client1.shutdown();
        client2.shutdown();
    }
}
```

### 2.4 加锁与释放流程
#### 加锁流程：串行获取+失败自动回滚
1.  初始化总等待时间：根据用户设置的`waitTime`，计算每个子锁的剩余等待时间，确保整体耗时不超过限制；
2.  按顺序获取子锁：遍历所有子锁，按传入顺序依次调用`tryLock`，每个子锁的加锁逻辑与普通`RLock`一致；
3.  结果处理：
    - 所有子锁获取成功：`MultiLock`加锁成功，开启所有子锁的看门狗续期；
    - 任意子锁获取失败：立刻终止后续加锁流程，逆序释放所有已获取的子锁，返回加锁失败。

#### 释放流程：逆序释放+异常兼容
1.  逆序释放子锁：按与加锁相反的顺序释放子锁，降低死锁概率；
2.  原子性释放每个子锁：通过Lua脚本判断锁归属、处理重入次数，成功则发送Pub/Sub信号；
3.  异常兼容：即使某个子锁释放失败，也会继续释放其他子锁，最终抛出异常提醒用户；
4.  取消看门狗：终止所有子锁的续期任务，避免无效续期。

### 2.5 关键注意事项与踩坑指南
1.  **加锁顺序必须全局一致**：若不同客户端对同一批子锁使用不同的加锁顺序（如A按`lock1→lock2`，B按`lock2→lock1`），会出现循环等待导致死锁；
2.  **不适合节点故障容错场景**：只要有一个Redis节点故障，`MultiLock`就会加锁失败，这类场景应使用`RedissonRedLock`；
3.  **性能开销需关注**：`MultiLock`需要与多个Redis节点通信，延迟比单锁高，跨机房场景需合理设置超时时间；
4.  **看门狗的局限性**：若包含跨节点子锁，当其中一个Redis节点故障时，看门狗无法为该节点的锁续期，锁会自动过期导致`MultiLock`失效。

---

## 三、三种锁方案对比：RLock vs MultiLock vs RedissonRedLock
| 对比项 | 普通RLock | MultiLock | RedissonRedLock |
| :--- | :--- | :--- | :--- |
| 加锁成功条件 | 单个锁获取成功 | 所有子锁都获取成功 | 超过半数（N/2+1）子锁获取成功 |
| 容错性 | 无（依赖单个节点） | 低（任意节点故障即失败） | 高（允许少数节点故障） |
| 适用场景 | 单Redis节点/主从集群的分布式锁 | 多资源原子加锁、跨节点强一致场景 | Redis节点故障容错的高可用分布式锁 |
| 性能 | 高（单节点通信） | 中（多节点串行通信） | 中（多节点通信） |
| 看门狗支持 | 支持 | 支持（所有子锁续期） | 支持 |

---

## 四、Redisson锁的最佳实践
1.  **优先使用普通RLock**：单资源场景下，`RLock`性能最优，且机制成熟稳定；
2.  **MultiLock仅用于多资源原子场景**：不要为了跨节点容错使用`MultiLock`，这类场景应选择`RedissonRedLock`；
3.  **加锁顺序全局统一**：所有客户端对同一批子锁的加锁顺序必须一致，避免死锁；
4.  **合理设置超时时间**：`waitTime`避免设置过长导致业务阻塞，`leaseTime`需大于业务执行时间，或依赖看门狗续期；
5.  **释放锁必须在finally中执行**：避免业务异常导致锁无法释放，造成死锁。

---

## 五、总结
Redisson的分布式锁并非银弹，不同的锁实现对应不同的业务场景：普通`RLock`解决单资源的分布式互斥问题，`MultiLock`解决多资源加锁的原子性问题，而`RedissonRedLock`则解决Redis节点故障的容错问题。

理解底层的Lua脚本、看门狗、Pub/Sub机制，以及`MultiLock`的加锁回滚逻辑，才能在实际业务中避免死锁、锁泄漏等问题，让分布式锁真正可靠。

后续会更新`RedissonRedLock`的原理与实现，以及分布式锁的常见面试题解析，欢迎关注~

