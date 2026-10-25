package boundary

import (
	"regexp"
	"strings"
)

// Known vendor wrappers, taken from the servers' source:
//   MongoDB  packages/core/src/toolBase.ts                  <untrusted-user-data-{uuid}>
//   Supabase packages/mcp-server-supabase/src/tools/util.ts  <untrusted-data-{uuid}>

const uuidPat = `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`

type Vendor string

const (
	VendorMongoDB  Vendor = "mongodb"
	VendorSupabase Vendor = "supabase"
)

type Unwrapped struct {
	Vendor      Vendor
	Description string
	Inner       string
}

type format struct {
	vendor Vendor
	open   *regexp.Regexp // captures uuid, anchored to line start
	close  string         // template, %s = uuid
	desc   *regexp.Regexp
}

var formats = []format{
	{
		vendor: VendorMongoDB,
		open:   regexp.MustCompile(`(?:^|\n)<untrusted-user-data-(` + uuidPat + `)>\n`),
		close:  "\n</untrusted-user-data-%s>",
		desc:   regexp.MustCompile(`^([\s\S]*?)\n*The following section contains unverified user data\.`),
	},
	{
		vendor: VendorSupabase,
		open:   regexp.MustCompile(`(?:^|\n)<untrusted-data-(` + uuidPat + `)>\n`),
		close:  "\n</untrusted-data-%s>",
		desc:   regexp.MustCompile(`Below is ([\s\S]*?)\. Note that this contains untrusted user data`),
	},
}

var spaces = regexp.MustCompile(`\s+`)

// UnwrapKnown returns nil unless the text is exactly one known wrapper with a
// matching open and close uuid. Anything else takes the plain wrap path.
func UnwrapKnown(text string) *Unwrapped {
	for _, f := range formats {
		loc := f.open.FindStringSubmatchIndex(text)
		if loc == nil {
			continue
		}
		uuid := text[loc[2]:loc[3]]
		closer := strings.Replace(f.close, "%s", uuid, 1)
		after := loc[1]
		closeAt := strings.Index(text[after:], closer)
		if closeAt < 0 {
			continue
		}
		rest := text[:loc[0]] + text[after+closeAt+len(closer):]
		if second := f.open.FindStringSubmatchIndex(rest); second != nil {
			u2 := rest[second[2]:second[3]]
			if strings.Contains(rest[second[1]:], strings.Replace(f.close, "%s", u2, 1)) {
				return nil
			}
		}
		desc := ""
		if d := f.desc.FindStringSubmatch(text); d != nil {
			desc = strings.TrimSpace(spaces.ReplaceAllString(d[1], " "))
			if len(desc) > 120 {
				desc = desc[:120]
			}
		}
		return &Unwrapped{Vendor: f.vendor, Description: desc, Inner: text[after : after+closeAt]}
	}
	return nil
}
