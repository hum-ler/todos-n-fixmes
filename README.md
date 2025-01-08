# todos-n-fixmes README

Lists TODOs & FIXMEs in the Problems pane.

## Features

TODOs, FIXMEs, todo!() macros (Rust) can now be seen as Info in the Problems pane. Should not conflict with rust-analyzer.

## Requirements

VSCode only. Local only. UTF-8 files only. '\n' newlines only.

## Extension Settings

This extension contributes the following settings:

- `todos-n-fixmes.caseInsensitiveSearch`: Ignore case when searching for keywords.
- `todos-n-fixmes.globPattern`: Defines the pattern of files to search. See [Glob Patterns Reference](https://code.visualstudio.com/docs/editor/glob-patterns).
- `todos-n-fixmes.keywords`: List of keywords to search for.
- `todos-n-fixmes.resultDisplayMaximumLength`: Maximum length of the line shown in the Problems pane when a keyword is found.

## Known Issues

- Keyword search does not look for word boundaries.

## Release Notes

### 0.0.1

Initial release for personal use.
