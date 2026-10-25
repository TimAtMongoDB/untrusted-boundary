// untrusted-boundary: one binary, one subcommand per Claude Code hook event.
//
//	untrusted-boundary post-tool-use   < hook input JSON
//	untrusted-boundary pre-tool-use    < hook input JSON
//	untrusted-boundary pre-compact     < hook input JSON
//	untrusted-boundary post-compact    < hook input JSON
//	untrusted-boundary session-start   < hook input JSON
//	untrusted-boundary ack             (run by a human after reading a leak report)
package main

import (
	"fmt"
	"os"

	"untrusted-boundary/internal/hook"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: untrusted-boundary <post-tool-use|pre-tool-use|pre-compact|post-compact|session-start|ack>")
		os.Exit(1)
	}
	if os.Args[1] == "ack" {
		cwd := os.Getenv("CLAUDE_PROJECT_DIR")
		if cwd == "" {
			cwd, _ = os.Getwd()
		}
		os.Exit(hook.Ack(cwd))
	}
	in, err := hook.ReadInput(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "untrusted-boundary: bad hook input: %v\n", err)
		os.Exit(1)
	}
	switch os.Args[1] {
	case "post-tool-use":
		os.Exit(hook.PostToolUse(in))
	case "pre-tool-use":
		os.Exit(hook.PreToolUse(in))
	case "pre-compact":
		os.Exit(hook.PreCompact(in))
	case "post-compact":
		os.Exit(hook.PostCompact(in))
	case "session-start":
		os.Exit(hook.SessionStart(in))
	default:
		fmt.Fprintf(os.Stderr, "untrusted-boundary: unknown subcommand %q\n", os.Args[1])
		os.Exit(1)
	}
}
