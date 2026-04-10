---
title: Synchronized 与 ReentrantLock
author: Cole
tags:
  - Java
  - 并发
categories: 开发
cover: fm.png
description: 'Synchronized 与 ReentrantLock '
date: 2026-04-10 16:13:16
---

# Java 并发：synchronized 与 ReentrantLock 全面解析


## 一、前言
在 Java 多线程编程中，**线程安全**是核心问题。`synchronized` 与 `ReentrantLock` 是最常用的两种同步方案，都能实现**可重入独占锁**，保证临界区代码的原子性、可见性与有序性。

本文从**底层原理、使用方式、核心特性、对比选型**四个维度，帮你彻底搞懂二者的区别与适用场景。

## 二、synchronized 详解
### 2.1 基本介绍
`synchronized` 是 JVM 内置的**隐式锁**，由 JVM 自动管理加锁与释放，无需手动编码，使用简单、安全。

### 2.2 底层原理
- 字节码：通过 `monitorenter`/`monitorexit` 指令实现
- 运行时：依赖对象头 Mark Word 与 Monitor（监视器锁）
- JDK 1.6+ 优化：偏向锁 → 轻量级锁 → 重量级锁 自动升级

### 2.3 三种使用方式
```java
// 1. 修饰实例方法（锁当前对象 this）
public synchronized void method() {
    // 临界区
}

// 2. 修饰静态方法（锁当前类 Class 对象）
public static synchronized void staticMethod() {
    // 临界区
}

// 3. 同步代码块（自定义锁对象，粒度更细）
public void blockMethod() {
    synchronized (this) {
        // 临界区
    }
}
```

### 2.4 核心特点
- 自动加锁、自动释放（正常结束/异常都会释放）
- 仅支持**非公平锁**，无法配置
- 不支持响应中断、不支持超时获取
- 语法简洁，不易出错，适合简单同步场景

## 三、ReentrantLock 详解
### 3.1 基本介绍
`ReentrantLock` 是 JUC 包提供的**显式锁**，基于 **AQS(AbstractQueuedSynchronizer)** 实现，功能更强大、可控性更高。

### 3.2 标准使用模板
**必须配合 try-finally 确保锁释放**，避免死锁
```java
import java.util.concurrent.locks.ReentrantLock;

public class ReentrantLockDemo {
    private final ReentrantLock lock = new ReentrantLock();

    public void work() {
        // 加锁
        lock.lock();
        try {
            // 临界区业务逻辑
        } finally {
            // 必须在 finally 释放锁
            lock.unlock();
        }
    }
}
```

### 3.3 高级特性（核心优势）
1. **支持公平/非公平锁**
```java
ReentrantLock fairLock = new ReentrantLock(true);   // 公平锁（FIFO）
ReentrantLock unfairLock = new ReentrantLock();    // 非公平锁（默认）
```

2. **支持响应中断**
```java
lock.lockInterruptibly(); // 等待锁时可被中断，避免永久阻塞
```

3. **支持超时获取锁**
```java
boolean tryLock = lock.tryLock(1, TimeUnit.SECONDS);
```

4. **可绑定多个 Condition** 实现精准唤醒

## 四、核心对比（面试高频）
| 对比项 | synchronized | ReentrantLock |
| :--- | :--- | :--- |
| **实现层面** | JVM 原生实现 | Java 代码基于 AQS 实现 |
| **锁管理** | 隐式，自动加释放 | 显式，手动 lock/unlock |
| **公平性** | 仅非公平 | 支持公平/非公平切换 |
| **中断支持** | 不支持 | 支持 lockInterruptibly |
| **超时获取** | 不支持 | 支持 tryLock(timeout) |
| **Condition** | 不支持，只能 wait/notify | 支持多 Condition 精准唤醒 |
| **使用成本** | 极简，不易出错 | 需手动释放，易遗漏 |
| **性能** | JDK 1.8+ 优化后接近 | 高并发下更可控 |

## 五、如何选型（实用建议）
1. **优先使用 synchronized**
- 简单同步场景、代码量少
- 无需复杂特性，追求安全与简洁
- JVM 会持续优化，维护成本更低

2. **选择 ReentrantLock**
- 需要**公平锁**避免线程饥饿
- 需要**中断、超时**防止死锁
- 需要**多 Condition** 实现精细化线程调度

## 六、常见避坑
1. **ReentrantLock 必须在 finally 里 unlock**，否则极易造成锁泄漏
2. 锁对象尽量用 `private final` 修饰，避免被外部修改
3. 不要在循环中频繁加锁释放，影响性能
4. 锁粒度尽可能小，只包裹临界区

## 七、总结
- `synchronized`：**简单、安全、省心**，适合绝大多数常规场景
- `ReentrantLock`：**灵活、强大、可控**，适合复杂并发调度

日常开发优先 `synchronized`；遇到高级并发需求，再用 `ReentrantLock` 针对性解决。

