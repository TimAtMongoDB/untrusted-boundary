// Package hook holds what the Claude Code hook subcommands share: stdin
// input, the state directory, the log, the per-session ledger, and a walker
// over every string in a JSON value.
package hook

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"untrusted-boundary/internal/boundary"
)

type Input struct {
	SessionID      string          `json:"session_id"`
	TranscriptPath string          `json:"transcript_path"`
	Cwd            string          `json:"cwd"`
	Event          string          `json:"hook_event_name"`
	ToolName       string          `json:"tool_name"`
	ToolInput      json.RawMessage `json:"tool_input"`
	ToolResponse   json.RawMessage `json:"tool_response"`
	ToolUseID      string          `json:"tool_use_id"`
	Source         string          `json:"source"`
	Trigger        string          `json:"trigger"`
	CompactSummary string          `json:"compact_summary"`
}

func ReadInput(r io.Reader) (Input, error) {
	var in Input
	b, err := io.ReadAll(r)
	if err != nil {
		return in, err
	}
	if len(b) == 0 {
		return in, nil
	}
	return in, json.Unmarshal(b, &in)
}

func StateDir(cwd string) string {
	if cwd == "" {
		cwd, _ = os.Getwd()
	}
	dir := filepath.Join(cwd, ".claude", "untrusted-boundary")
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

func Log(cwd string, event map[string]any) {
	event["at"] = time.Now().UTC().Format(time.RFC3339Nano)
	line, _ := json.Marshal(event)
	f, err := os.OpenFile(filepath.Join(StateDir(cwd), "log.jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.Write(append(line, '\n'))
}

var unsafeChars = regexp.MustCompile(`[^A-Za-z0-9_-]`)

func ledgerPath(cwd, session string) string {
	if session == "" {
		session = "no-session"
	}
	return filepath.Join(StateDir(cwd), "ledger-"+unsafeChars.ReplaceAllString(session, "_")+".jsonl")
}

func LedgerAppend(in Input, e boundary.LedgerEntry) {
	e.At = time.Now().UTC().Format(time.RFC3339Nano)
	line, _ := json.Marshal(e)
	f, err := os.OpenFile(ledgerPath(in.Cwd, in.SessionID), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.Write(append(line, '\n'))
}

func LedgerRead(in Input) []boundary.LedgerEntry {
	f, err := os.Open(ledgerPath(in.Cwd, in.SessionID))
	if err != nil {
		return nil
	}
	defer f.Close()
	var out []boundary.LedgerEntry
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1<<20), 64<<20)
	for sc.Scan() {
		var e boundary.LedgerEntry
		if json.Unmarshal(sc.Bytes(), &e) == nil {
			out = append(out, e)
		}
	}
	return out
}

// Strings yields every string value in a JSON document, at any depth.
func Strings(raw []byte, fn func(string)) {
	var v any
	if json.Unmarshal(raw, &v) != nil {
		return
	}
	walk(v, fn)
}

func walk(v any, fn func(string)) {
	switch t := v.(type) {
	case string:
		fn(t)
	case []any:
		for _, x := range t {
			walk(x, fn)
		}
	case map[string]any:
		for _, x := range t {
			walk(x, fn)
		}
	}
}

// ExtractText pulls the text out of a tool response, whatever its shape.
func ExtractText(raw []byte) string {
	var v any
	if json.Unmarshal(raw, &v) != nil {
		return string(raw)
	}
	return textOf(v)
}

func textOf(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case []any:
		var parts []string
		for _, x := range t {
			if s := textOf(x); s != "" {
				parts = append(parts, s)
			}
		}
		return joinLines(parts)
	case map[string]any:
		if c, ok := t["content"]; ok {
			return textOf(c)
		}
		if s, ok := t["text"].(string); ok {
			return s
		}
	}
	b, _ := json.Marshal(v)
	return string(b)
}

func joinLines(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += "\n"
		}
		out += p
	}
	return out
}

// ReplaceText gives back the response in its original shape with the text swapped.
func ReplaceText(raw []byte, text string) any {
	var v any
	if json.Unmarshal(raw, &v) != nil {
		return text
	}
	switch t := v.(type) {
	case string:
		return text
	case []any:
		return []any{map[string]any{"type": "text", "text": text}}
	case map[string]any:
		if _, ok := t["content"]; ok {
			t["content"] = []any{map[string]any{"type": "text", "text": text}}
			return t
		}
	}
	return text
}

func Emit(v any) {
	b, _ := json.Marshal(v)
	fmt.Fprintln(os.Stdout, string(b))
}
