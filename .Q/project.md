# instructions for Fiji

- prioritize using packages over writing custom code 
- read documentation in docs/ and .Q/ directories 
- when you are not sure about something, ask 
- always consult the technical-specs 
- keep the documentation up to date 
- keep the code simple. avoid unnecessary complexity. use libraries and packages when possible. avoid deeply nested code.
- use version control (git) for all code.
- use uv for package management.
- the backend has been initialised with uv. use the existing venv environment.
- use the existing pyproject.toml file for package management.
- if you need to create temporary scirpts, files, etc. use the tmp directory.
- the root directory for the backend is backend/. use direct imports from the backend directory.
- when adding placehoders for future code, use the TODO comment format.
- DO NOT under any circumstances modify the pyproject.toml file.- use uv to manage packages. e.g `uv add <package_name>`, `uv run <py_file>`, `uv test <package_name>`, etc.
- always use -m for git commits. e.g `git commit -m "your message"`.
- do not escape backtcks and other special characters in commit messages.
