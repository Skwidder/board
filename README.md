# Board

## Quickstart

Make python virtual environment for the frontend and setup `config.js`
```bash
$ cd frontend/
$ python -m venv env
$ . env/bin/activate
$ pip install -r requirements.txt
$ cp templates/config.js.example templates/config.js

# make any necessary changes to config.js
# for example, set shared=true
```

Run the frontend
```bash
$ cd frontend/
$ . env/bin/activate
$ python app.py
```

Run the backend
```bash
$ cd backend/
$ go run *.go
```
