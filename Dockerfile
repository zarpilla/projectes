FROM node:16

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 1337
CMD ["npm", "run", "start"]

# build for production

#docker build \
#  --build-arg NODE_ENV=production \
#  # --build-arg STRAPI_URL=https://api.example.com \ # Uncomment to set the Strapi Server URL
#  -t re-web-backend:latest \ # Replace with your image name
#  -f Dockerfile.prod .

