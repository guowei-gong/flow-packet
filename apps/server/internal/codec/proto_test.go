package codec

import (
	"context"
	"strings"
	"testing"

	"github.com/bufbuild/protocompile"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// compileProto 编译 proto 内容，返回指定 message 的 descriptor
func compileProto(t *testing.T, content, msgName string) protoreflect.MessageDescriptor {
	t.Helper()

	resolver := &protocompile.SourceResolver{
		Accessor: protocompile.SourceAccessorFromMap(map[string]string{
			"test.proto": content,
		}),
	}

	compiler := &protocompile.Compiler{
		Resolver: protocompile.WithStandardImports(resolver),
	}

	compiled, err := compiler.Compile(context.Background(), "test.proto")
	if err != nil {
		t.Fatalf("compile proto: %v", err)
	}

	fd := compiled[0]
	md := fd.Messages().ByName(protoreflect.Name(msgName))
	if md == nil {
		t.Fatalf("message %q not found", msgName)
	}
	return md
}

func TestDynamicEncodeBasicTypes(t *testing.T) {
	proto := `syntax = "proto3";
message TestMsg {
  string name = 1;
  int32 age = 2;
  bool active = 3;
  int64 score = 4;
  double rating = 5;
}`
	md := compileProto(t, proto, "TestMsg")

	fields := map[string]any{
		"name":   "alice",
		"age":    int(25),
		"active": true,
		"score":  int64(1000),
		"rating": 4.5,
	}

	data, err := DynamicEncode(md, fields)
	if err != nil {
		t.Fatalf("DynamicEncode error: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("encoded data is empty")
	}

	// 解码回来验证
	result, err := DynamicDecode(data, md)
	if err != nil {
		t.Fatalf("DynamicDecode error: %v", err)
	}

	if result["name"] != "alice" {
		t.Fatalf("name = %v, want %q", result["name"], "alice")
	}
	if result["age"] != int32(25) {
		t.Fatalf("age = %v (%T), want 25", result["age"], result["age"])
	}
	if result["active"] != true {
		t.Fatalf("active = %v, want true", result["active"])
	}
}

func TestDynamicEncodeEnum(t *testing.T) {
	proto := `syntax = "proto3";
enum Status {
  UNKNOWN = 0;
  ACTIVE = 1;
  INACTIVE = 2;
}
message TestMsg {
  Status status = 1;
}`
	md := compileProto(t, proto, "TestMsg")

	data, err := DynamicEncode(md, map[string]any{"status": int(1)})
	if err != nil {
		t.Fatalf("DynamicEncode error: %v", err)
	}

	result, err := DynamicDecode(data, md)
	if err != nil {
		t.Fatalf("DynamicDecode error: %v", err)
	}

	if result["status"] != 1 {
		t.Fatalf("status = %v, want 1", result["status"])
	}
}

func TestDynamicEncodeNested(t *testing.T) {
	proto := `syntax = "proto3";
message Inner {
  string value = 1;
  int32 count = 2;
}
message Outer {
  string name = 1;
  Inner inner = 2;
}`
	md := compileProto(t, proto, "Outer")

	fields := map[string]any{
		"name": "test",
		"inner": map[string]any{
			"value": "nested",
			"count": int(42),
		},
	}

	data, err := DynamicEncode(md, fields)
	if err != nil {
		t.Fatalf("DynamicEncode error: %v", err)
	}

	result, err := DynamicDecode(data, md)
	if err != nil {
		t.Fatalf("DynamicDecode error: %v", err)
	}

	inner, ok := result["inner"].(map[string]any)
	if !ok {
		t.Fatalf("inner = %T, want map[string]any", result["inner"])
	}
	if inner["value"] != "nested" {
		t.Fatalf("inner.value = %v, want %q", inner["value"], "nested")
	}
}

func TestDynamicEncodeRepeated(t *testing.T) {
	proto := `syntax = "proto3";
message TestMsg {
  repeated string tags = 1;
  repeated int32 scores = 2;
}`
	md := compileProto(t, proto, "TestMsg")

	fields := map[string]any{
		"tags":   []any{"a", "b", "c"},
		"scores": []any{int(100), int(200)},
	}

	data, err := DynamicEncode(md, fields)
	if err != nil {
		t.Fatalf("DynamicEncode error: %v", err)
	}

	result, err := DynamicDecode(data, md)
	if err != nil {
		t.Fatalf("DynamicDecode error: %v", err)
	}

	tags, ok := result["tags"].([]any)
	if !ok {
		t.Fatalf("tags type = %T, want []any", result["tags"])
	}
	if len(tags) != 3 {
		t.Fatalf("tags len = %d, want 3", len(tags))
	}
	if tags[0] != "a" || tags[1] != "b" || tags[2] != "c" {
		t.Fatalf("tags = %v, want [a b c]", tags)
	}
}

func TestDynamicEncodeRepeatedMessage(t *testing.T) {
	proto := `syntax = "proto3";
message Item {
  string name = 1;
  int32 count = 2;
}
message TestMsg {
  repeated Item items = 1;
}`
	md := compileProto(t, proto, "TestMsg")

	fields := map[string]any{
		"items": []any{
			map[string]any{"name": "sword", "count": int(1)},
			map[string]any{"name": "potion", "count": int(5)},
		},
	}

	data, err := DynamicEncode(md, fields)
	if err != nil {
		t.Fatalf("DynamicEncode error: %v", err)
	}

	result, err := DynamicDecode(data, md)
	if err != nil {
		t.Fatalf("DynamicDecode error: %v", err)
	}

	items, ok := result["items"].([]any)
	if !ok {
		t.Fatalf("items type = %T, want []any", result["items"])
	}
	if len(items) != 2 {
		t.Fatalf("items len = %d, want 2", len(items))
	}

	item0, ok := items[0].(map[string]any)
	if !ok {
		t.Fatalf("items[0] type = %T, want map[string]any", items[0])
	}
	if item0["name"] != "sword" {
		t.Fatalf("items[0].name = %v, want %q", item0["name"], "sword")
	}
}

func TestDynamicEncodeMap(t *testing.T) {
	proto := `syntax = "proto3";
message TestMsg {
  map<string, int32> attrs = 1;
}`
	md := compileProto(t, proto, "TestMsg")

	fields := map[string]any{
		"attrs": map[string]any{
			"str": int(10),
			"agi": int(20),
		},
	}

	data, err := DynamicEncode(md, fields)
	if err != nil {
		t.Fatalf("DynamicEncode error: %v", err)
	}

	result, err := DynamicDecode(data, md)
	if err != nil {
		t.Fatalf("DynamicDecode error: %v", err)
	}

	attrs, ok := result["attrs"].(map[string]any)
	if !ok {
		t.Fatalf("attrs type = %T, want map[string]any", result["attrs"])
	}
	if attrs["str"] != int32(10) {
		t.Fatalf("attrs[str] = %v (%T), want 10", attrs["str"], attrs["str"])
	}
}

func TestDynamicDecodeWithoutDescriptor(t *testing.T) {
	data := []byte{0x0A, 0x05, 0x68, 0x65, 0x6C, 0x6C, 0x6F}

	result, err := DynamicDecode(data, nil)
	if err != nil {
		t.Fatalf("DynamicDecode error: %v", err)
	}

	hexStr, ok := result["_hex"].(string)
	if !ok {
		t.Fatal("expected _hex field for unknown descriptor")
	}
	if !strings.EqualFold(hexStr, "0a0568656c6c6f") {
		t.Fatalf("_hex = %q, want %q", hexStr, "0a0568656c6c6f")
	}
}

func TestDynamicEncodeUnknownField(t *testing.T) {
	proto := `syntax = "proto3";
message TestMsg {
  string name = 1;
}`
	md := compileProto(t, proto, "TestMsg")

	_, err := DynamicEncode(md, map[string]any{"nonexistent": "value"})
	if err == nil {
		t.Fatal("expected error for unknown field")
	}
}

func TestDynamicEncodeBytes(t *testing.T) {
	proto := `syntax = "proto3";
message TestMsg {
  bytes data = 1;
}`
	md := compileProto(t, proto, "TestMsg")

	// 使用十六进制字符串
	data, err := DynamicEncode(md, map[string]any{"data": "deadbeef"})
	if err != nil {
		t.Fatalf("DynamicEncode error: %v", err)
	}

	result, err := DynamicDecode(data, md)
	if err != nil {
		t.Fatalf("DynamicDecode error: %v", err)
	}

	if result["data"] != "deadbeef" {
		t.Fatalf("data = %v, want %q", result["data"], "deadbeef")
	}
}
