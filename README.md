# Board

This is the only online go board that allows for synchronous control across all participants.

This project is free and open-source and always will be. Feel free to contribute by submitting PRs, reporting bugs, suggesting features, or just sharing with friends.

[Main page](https://board.tripleko.com)

[Test page](https://board-test.tripleko.com)

[Discord](https://discord.gg/y4wGZyed3e)

## Developing

If you make a pull request, please use `test` as the target branch. The test domain (above) tracks the `test` branch while the main domain tracks the `main` branch.

### Running locally

1. Install python
2. Install golang

3. Make python virtual environment for the frontend

```bash
$ cd frontend/
$ python -m venv env
$ . env/bin/activate
$ pip install -r requirements.txt
```

4. Run the frontend
```bash
$ cd frontend/
$ . env/bin/activate
$ python app.py
```

5. Run the backend
```bash
$ cd backend/
$ go run *.go
```

6. Visit `http://localhost:8080` in your browser.

### Running locally with docker

1. Install docker
2. Build the docker container

```bash
$ docker build . -t board
```

3. Run the docker container, binding the container ports to your host ports

```bash
$ docker run -p 8080:8080 -p 9000:9000 board
```

4. Visit `http://localhost:8080` in your browser

