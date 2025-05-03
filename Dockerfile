FROM ubuntu:latest

RUN apt-get update && apt-get -y upgrade

RUN apt-get install -y golang
RUN apt-get install -y python3

RUN apt-get install -y pip

ADD frontend /root/frontend
ADD backend /root/backend

RUN pip install -r /root/frontend/requirements.txt --break-system-packages

RUN sed -i -e 's/run(/run(host="0.0.0.0",/g' /root/frontend/app.py
RUN sed -i -e 's/localhost/0.0.0.0/g' /root/backend/main.go

EXPOSE 8080
EXPOSE 9000

RUN echo "python3 /root/frontend/app.py & cd /root/backend && go run *.go" > /root/start.sh
CMD ["sh", "/root/start.sh"]
