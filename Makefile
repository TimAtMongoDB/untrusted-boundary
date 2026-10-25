BIN=untrusted-boundary
LDFLAGS=-s -w

.PHONY: build test release clean

build:
	go build -ldflags="$(LDFLAGS)" -o bin/$(BIN) ./cmd/$(BIN)

test:
	go vet ./... && go test ./...

release:
	mkdir -p dist
	GOOS=linux   GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o dist/$(BIN)-linux-amd64 ./cmd/$(BIN)
	GOOS=linux   GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o dist/$(BIN)-linux-arm64 ./cmd/$(BIN)
	GOOS=darwin  GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o dist/$(BIN)-darwin-arm64 ./cmd/$(BIN)
	GOOS=darwin  GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o dist/$(BIN)-darwin-amd64 ./cmd/$(BIN)
	GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o dist/$(BIN)-windows-amd64.exe ./cmd/$(BIN)

clean:
	rm -rf bin dist
