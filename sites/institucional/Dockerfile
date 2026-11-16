FROM nginx:alpine
COPY . /usr/share/nginx/html/
RUN chmod -R a+rX /usr/share/nginx/html && \
    printf 'server {\n  listen 80 default_server;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n  autoindex off;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
