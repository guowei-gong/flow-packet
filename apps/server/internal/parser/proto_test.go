package parser

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func testdataPath(name string) string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "testdata", name)
}

func TestParseSingleFile(t *testing.T) {
	result, err := ParseProtoFiles([]string{testdataPath("simple.proto")})
	if err != nil {
		t.Fatalf("ParseProtoFiles error: %v", err)
	}

	if len(result.Files) != 1 {
		t.Fatalf("files count = %d, want 1", len(result.Files))
	}

	fi := result.Files[0]
	if fi.Package != "game" {
		t.Fatalf("package = %q, want %q", fi.Package, "game")
	}

	if len(fi.Messages) != 3 {
		t.Fatalf("message count = %d, want 3", len(fi.Messages))
	}

	// 验证 LoginRequest
	login := fi.Messages[0]
	if login.ShortName != "LoginRequest" {
		t.Fatalf("message[0].ShortName = %q, want %q", login.ShortName, "LoginRequest")
	}
	if len(login.Fields) != 3 {
		t.Fatalf("LoginRequest field count = %d, want 3", len(login.Fields))
	}

	// 验证字段类型
	if login.Fields[0].Type != "string" || login.Fields[0].Name != "username" {
		t.Fatalf("field[0] = %+v, want username/string", login.Fields[0])
	}
	if login.Fields[2].Type != "int32" || login.Fields[2].Name != "platform" {
		t.Fatalf("field[2] = %+v, want platform/int32", login.Fields[2])
	}

	// 验证 LoginResponse 包含 message 类型字段
	resp := fi.Messages[1]
	if resp.ShortName != "LoginResponse" {
		t.Fatalf("message[1].ShortName = %q, want %q", resp.ShortName, "LoginResponse")
	}
	userField := resp.Fields[2]
	if userField.Kind != "message" || userField.Type != "game.UserInfo" {
		t.Fatalf("user field = %+v, want kind=message, type=game.UserInfo", userField)
	}
}

func TestParseMultiFileWithImport(t *testing.T) {
	result, err := ParseProtoFiles([]string{
		testdataPath("complex.proto"),
		testdataPath("common.proto"),
	})
	if err != nil {
		t.Fatalf("ParseProtoFiles error: %v", err)
	}

	// 应有两个文件
	if len(result.Files) != 2 {
		t.Fatalf("files count = %d, want 2", len(result.Files))
	}

	// 找到 complex.proto 的结果
	var complexFile *FileInfo
	for i := range result.Files {
		if strings.Contains(result.Files[i].Path, "complex") {
			complexFile = &result.Files[i]
			break
		}
	}
	if complexFile == nil {
		t.Fatal("complex.proto not found in results")
	}

	// 验证 BattleRequest
	var battle *MessageInfo
	for i := range complexFile.Messages {
		if complexFile.Messages[i].ShortName == "BattleRequest" {
			battle = &complexFile.Messages[i]
			break
		}
	}
	if battle == nil {
		t.Fatal("BattleRequest not found")
	}

	// 验证 repeated 字段
	var itemsField *FieldInfo
	for i := range battle.Fields {
		if battle.Fields[i].Name == "items" {
			itemsField = &battle.Fields[i]
			break
		}
	}
	if itemsField == nil {
		t.Fatal("items field not found")
	}
	if !itemsField.IsRepeated {
		t.Fatal("items should be repeated")
	}
	if itemsField.Kind != "message" {
		t.Fatalf("items.Kind = %q, want %q", itemsField.Kind, "message")
	}

	// 验证 enum 字段
	var enumField *FieldInfo
	for i := range battle.Fields {
		if battle.Fields[i].Name == "expected_code" {
			enumField = &battle.Fields[i]
			break
		}
	}
	if enumField == nil {
		t.Fatal("expected_code field not found")
	}
	if enumField.Kind != "enum" {
		t.Fatalf("expected_code.Kind = %q, want %q", enumField.Kind, "enum")
	}

	// 验证 map 字段
	var mapField *FieldInfo
	for i := range battle.Fields {
		if battle.Fields[i].Name == "attributes" {
			mapField = &battle.Fields[i]
			break
		}
	}
	if mapField == nil {
		t.Fatal("attributes field not found")
	}
	if !mapField.IsMap {
		t.Fatal("attributes should be map")
	}
	if mapField.MapKey != "string" {
		t.Fatalf("attributes.MapKey = %q, want %q", mapField.MapKey, "string")
	}
	if mapField.MapValue != "int32" {
		t.Fatalf("attributes.MapValue = %q, want %q", mapField.MapValue, "int32")
	}

	// 验证 oneof
	if len(battle.Oneofs) != 1 {
		t.Fatalf("oneof count = %d, want 1", len(battle.Oneofs))
	}
	if battle.Oneofs[0].Name != "strategy" {
		t.Fatalf("oneof name = %q, want %q", battle.Oneofs[0].Name, "strategy")
	}
	if len(battle.Oneofs[0].Fields) != 2 {
		t.Fatalf("oneof fields count = %d, want 2", len(battle.Oneofs[0].Fields))
	}

	// 验证 oneof 字段的 OneofName
	var attackField *FieldInfo
	for i := range battle.Fields {
		if battle.Fields[i].Name == "attack_mode" {
			attackField = &battle.Fields[i]
			break
		}
	}
	if attackField == nil {
		t.Fatal("attack_mode field not found")
	}
	if attackField.OneofName != "strategy" {
		t.Fatalf("attack_mode.OneofName = %q, want %q", attackField.OneofName, "strategy")
	}

	// 验证 optional 字段
	var optField *FieldInfo
	for i := range battle.Fields {
		if battle.Fields[i].Name == "auto_battle" {
			optField = &battle.Fields[i]
			break
		}
	}
	if optField == nil {
		t.Fatal("auto_battle field not found")
	}
	if !optField.IsOptional {
		t.Fatal("auto_battle should be optional")
	}
}

func TestParseInvalidProto(t *testing.T) {
	_, err := ParseProtoFiles([]string{testdataPath("invalid.proto")})
	if err == nil {
		t.Fatal("expected error for invalid proto file")
	}
}

func TestParseFromReader(t *testing.T) {
	content := `syntax = "proto3";
package test;

message Ping {
  int64 timestamp = 1;
}
`
	result, err := ParseProtoReader("test.proto", strings.NewReader(content))
	if err != nil {
		t.Fatalf("ParseProtoReader error: %v", err)
	}

	if len(result.Files) != 1 {
		t.Fatalf("files count = %d, want 1", len(result.Files))
	}

	if len(result.Files[0].Messages) != 1 {
		t.Fatalf("message count = %d, want 1", len(result.Files[0].Messages))
	}

	msg := result.Files[0].Messages[0]
	if msg.ShortName != "Ping" {
		t.Fatalf("message name = %q, want %q", msg.ShortName, "Ping")
	}
}

func TestAllMessages(t *testing.T) {
	result, err := ParseProtoFiles([]string{testdataPath("simple.proto")})
	if err != nil {
		t.Fatalf("ParseProtoFiles error: %v", err)
	}

	all := result.AllMessages()
	if len(all) != 3 {
		t.Fatalf("AllMessages count = %d, want 3", len(all))
	}
}

func TestParseEnum(t *testing.T) {
	result, err := ParseProtoFiles([]string{testdataPath("common.proto")})
	if err != nil {
		t.Fatalf("ParseProtoFiles error: %v", err)
	}

	fi := result.Files[0]
	if len(fi.Enums) != 1 {
		t.Fatalf("enum count = %d, want 1", len(fi.Enums))
	}

	enum := fi.Enums[0]
	if enum.Name != "common.ErrorCode" {
		t.Fatalf("enum name = %q, want %q", enum.Name, "common.ErrorCode")
	}
	if len(enum.Values) != 4 {
		t.Fatalf("enum values count = %d, want 4", len(enum.Values))
	}
	if enum.Values[0].Name != "OK" || enum.Values[0].Number != 0 {
		t.Fatalf("enum value[0] = %+v, want OK/0", enum.Values[0])
	}
}

func TestParseEmptyPaths(t *testing.T) {
	result, err := ParseProtoFiles([]string{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Files) != 0 {
		t.Fatalf("files count = %d, want 0", len(result.Files))
	}
}
