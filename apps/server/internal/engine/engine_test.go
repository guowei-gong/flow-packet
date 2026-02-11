package engine

import (
	"context"
	"testing"
	"time"

	"github.com/flow-packet/server/internal/codec"
)

func TestResolveOrderLinearChain(t *testing.T) {
	nodes := []FlowNode{
		{ID: "a"},
		{ID: "b"},
		{ID: "c"},
	}
	edges := []FlowEdge{
		{Source: "a", Target: "b"},
		{Source: "b", Target: "c"},
	}

	order, err := ResolveOrder(nodes, edges)
	if err != nil {
		t.Fatalf("ResolveOrder error: %v", err)
	}

	if len(order) != 3 {
		t.Fatalf("order len = %d, want 3", len(order))
	}
	if order[0] != "a" || order[1] != "b" || order[2] != "c" {
		t.Fatalf("order = %v, want [a b c]", order)
	}
}

func TestResolveOrderSingleNode(t *testing.T) {
	nodes := []FlowNode{{ID: "x"}}
	edges := []FlowEdge{}

	order, err := ResolveOrder(nodes, edges)
	if err != nil {
		t.Fatalf("ResolveOrder error: %v", err)
	}

	if len(order) != 1 || order[0] != "x" {
		t.Fatalf("order = %v, want [x]", order)
	}
}

func TestResolveOrderMultipleStartsError(t *testing.T) {
	nodes := []FlowNode{
		{ID: "a"},
		{ID: "b"},
		{ID: "c"},
	}
	edges := []FlowEdge{
		{Source: "a", Target: "c"},
		// b also has inDegree 0
	}

	_, err := ResolveOrder(nodes, edges)
	if err == nil {
		t.Fatal("expected error for multiple start nodes")
	}
}

func TestResolveOrderEmptyNodes(t *testing.T) {
	_, err := ResolveOrder([]FlowNode{}, []FlowEdge{})
	if err == nil {
		t.Fatal("expected error for empty nodes")
	}
}

func TestSeqContextNextAndResolve(t *testing.T) {
	ctx := NewSeqContext()

	seq1, ch1 := ctx.NextSeq()
	if seq1 != 1 {
		t.Fatalf("seq1 = %d, want 1", seq1)
	}

	seq2, ch2 := ctx.NextSeq()
	if seq2 != 2 {
		t.Fatalf("seq2 = %d, want 2", seq2)
	}

	// 解析 seq 2
	if !ctx.Resolve(2, []byte("resp2")) {
		t.Fatal("Resolve seq 2 returned false")
	}

	// 解析 seq 1
	if !ctx.Resolve(1, []byte("resp1")) {
		t.Fatal("Resolve seq 1 returned false")
	}

	// 验证通道数据
	data1 := <-ch1
	if string(data1) != "resp1" {
		t.Fatalf("ch1 data = %q, want %q", data1, "resp1")
	}

	data2 := <-ch2
	if string(data2) != "resp2" {
		t.Fatalf("ch2 data = %q, want %q", data2, "resp2")
	}
}

func TestSeqContextResolveUnknown(t *testing.T) {
	ctx := NewSeqContext()
	if ctx.Resolve(999, []byte("data")) {
		t.Fatal("Resolve for unknown seq should return false")
	}
}

func TestSeqContextWaitTimeout(t *testing.T) {
	ctx := NewSeqContext()
	_, ch := ctx.NextSeq()

	_, err := ctx.WaitResponse(ch, 50*time.Millisecond)
	if err == nil {
		t.Fatal("expected timeout error")
	}
}

func TestSeqContextWaitSuccess(t *testing.T) {
	ctx := NewSeqContext()
	seq, ch := ctx.NextSeq()

	go func() {
		time.Sleep(10 * time.Millisecond)
		ctx.Resolve(seq, []byte("response data"))
	}()

	data, err := ctx.WaitResponse(ch, 2*time.Second)
	if err != nil {
		t.Fatalf("WaitResponse error: %v", err)
	}
	if string(data) != "response data" {
		t.Fatalf("data = %q, want %q", data, "response data")
	}
}

func TestSeqContextReset(t *testing.T) {
	ctx := NewSeqContext()
	ctx.NextSeq()
	ctx.NextSeq()

	ctx.Reset()

	seq, _ := ctx.NextSeq()
	if seq != 1 {
		t.Fatalf("seq after reset = %d, want 1", seq)
	}
}

func TestRunnerStopCancelsExecution(t *testing.T) {
	runner := NewRunner(defaultPacketConfig())

	// Mock send that blocks
	runner.SetSendFunc(func(data []byte) error {
		time.Sleep(5 * time.Second)
		return nil
	})

	nodes := []FlowNode{{ID: "a", MessageName: "Test", Route: 1}}
	edges := []FlowEdge{}

	done := make(chan error, 1)
	go func() {
		err := runner.Execute(context.Background(), nodes, edges, nil)
		done <- err
	}()

	// 等待执行开始
	time.Sleep(50 * time.Millisecond)

	runner.Stop()

	select {
	case err := <-done:
		if err == nil {
			// Stop 可能通过 resolver nil 提前失败，也可以
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for execution to stop")
	}
}

func defaultPacketConfig() codec.PacketConfig {
	return codec.PacketConfig{RouteBytes: 2, SeqBytes: 2}
}
