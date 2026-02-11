package network

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestBackoffDuration(t *testing.T) {
	cfg := DefaultReconnectConfig() // initial=1s, multiplier=2.0, max=30s
	r := NewReconnector(cfg)

	tests := []struct {
		retry int
		want  time.Duration
	}{
		{0, 1 * time.Second},   // 初始等待
		{1, 2 * time.Second},   // 1s * 2
		{2, 4 * time.Second},   // 1s * 2 * 2
		{3, 8 * time.Second},   // 1s * 2^3
		{4, 16 * time.Second},  // 1s * 2^4
		{5, 30 * time.Second},  // 1s * 2^5 = 32s > 30s → 30s
		{6, 30 * time.Second},  // 仍然是 max
		{10, 30 * time.Second}, // 仍然是 max
	}

	for _, tt := range tests {
		got := r.BackoffDuration(tt.retry)
		if got != tt.want {
			t.Errorf("BackoffDuration(%d) = %v, want %v", tt.retry, got, tt.want)
		}
	}
}

func TestReconnectSuccess(t *testing.T) {
	cfg := ReconnectConfig{
		Enable:      true,
		InitialWait: 10 * time.Millisecond,
		MaxWait:     100 * time.Millisecond,
		MaxRetries:  5,
		Multiplier:  2.0,
	}
	r := NewReconnector(cfg)

	var attempts int32
	connectFn := func() error {
		n := atomic.AddInt32(&attempts, 1)
		if n < 3 {
			return errors.New("connection refused")
		}
		return nil // 第 3 次成功
	}

	success := make(chan struct{})
	onSuccess := func() {
		close(success)
	}

	r.Start(connectFn, onSuccess, nil)

	select {
	case <-success:
		if atomic.LoadInt32(&attempts) != 3 {
			t.Fatalf("attempts = %d, want 3", atomic.LoadInt32(&attempts))
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for reconnect success")
	}
}

func TestReconnectGiveUp(t *testing.T) {
	cfg := ReconnectConfig{
		Enable:      true,
		InitialWait: 10 * time.Millisecond,
		MaxWait:     50 * time.Millisecond,
		MaxRetries:  3,
		Multiplier:  2.0,
	}
	r := NewReconnector(cfg)

	var attempts int32
	connectFn := func() error {
		atomic.AddInt32(&attempts, 1)
		return errors.New("connection refused")
	}

	gaveUp := make(chan int, 1)
	onGiveUp := func(retries int) {
		gaveUp <- retries
	}

	r.Start(connectFn, nil, onGiveUp)

	select {
	case retries := <-gaveUp:
		if retries != 3 {
			t.Fatalf("retries = %d, want 3", retries)
		}
		if atomic.LoadInt32(&attempts) != 3 {
			t.Fatalf("attempts = %d, want 3", atomic.LoadInt32(&attempts))
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for give up")
	}
}

func TestReconnectStop(t *testing.T) {
	cfg := ReconnectConfig{
		Enable:      true,
		InitialWait: 100 * time.Millisecond,
		MaxWait:     1 * time.Second,
		MaxRetries:  10,
		Multiplier:  2.0,
	}
	r := NewReconnector(cfg)

	connectFn := func() error {
		return errors.New("connection refused")
	}

	r.Start(connectFn, nil, nil)

	// 等待第一次重试开始
	time.Sleep(50 * time.Millisecond)

	r.Stop()
	retries := r.Retries()

	// 等待一段时间确认不再重试
	time.Sleep(300 * time.Millisecond)

	retriesAfter := r.Retries()
	if retriesAfter != retries {
		t.Fatalf("retries changed after stop: before=%d, after=%d", retries, retriesAfter)
	}
}

func TestReconnectDisabled(t *testing.T) {
	cfg := ReconnectConfig{
		Enable:      false,
		InitialWait: 10 * time.Millisecond,
		MaxRetries:  5,
		Multiplier:  2.0,
	}
	r := NewReconnector(cfg)

	called := false
	r.Start(func() error { called = true; return nil }, nil, nil)

	time.Sleep(50 * time.Millisecond)

	if called {
		t.Fatal("connectFn should not be called when reconnect is disabled")
	}
}

func TestReconnectRetriesIncrement(t *testing.T) {
	cfg := ReconnectConfig{
		Enable:      true,
		InitialWait: 10 * time.Millisecond,
		MaxWait:     50 * time.Millisecond,
		MaxRetries:  5,
		Multiplier:  2.0,
	}
	r := NewReconnector(cfg)

	var attempts int32
	connectFn := func() error {
		atomic.AddInt32(&attempts, 1)
		return errors.New("fail")
	}

	gaveUp := make(chan struct{})
	r.Start(connectFn, nil, func(retries int) {
		close(gaveUp)
	})

	<-gaveUp

	if r.Retries() != 5 {
		t.Fatalf("retries = %d, want 5", r.Retries())
	}
}

func TestReconnectReset(t *testing.T) {
	cfg := ReconnectConfig{
		Enable:      true,
		InitialWait: 10 * time.Millisecond,
		MaxWait:     50 * time.Millisecond,
		MaxRetries:  2,
		Multiplier:  2.0,
	}
	r := NewReconnector(cfg)

	// 第一轮：全部失败
	gaveUp := make(chan struct{})
	r.Start(func() error { return errors.New("fail") }, nil, func(int) { close(gaveUp) })
	<-gaveUp

	if r.Retries() != 2 {
		t.Fatalf("retries after first round = %d, want 2", r.Retries())
	}

	// 重置后重试
	r.Reset()
	if r.Retries() != 0 {
		t.Fatalf("retries after reset = %d, want 0", r.Retries())
	}

	// 第二轮：立即成功
	success := make(chan struct{})
	r.Start(func() error { return nil }, func() { close(success) }, nil)

	select {
	case <-success:
		// 重置后可以重新使用
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for success after reset")
	}
}
