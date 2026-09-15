# change-logic-assignment
A simple app demonstrating a custom implementation of a multi-tenant survey app

# architecture
  - frontent (/client) - react (TS) + vite starter
  - backend (/api) - next (TS) + vite starter
  - db (docker-compose.yml) - 16 alpine postgress database in docker container

  # development
  
  Install dependencies for both apps, then run everything with one command:
  
  ```sh
  npm run install:all
  npm run dev
  ```
  
  This starts the API (http://localhost:3000) and the client (http://localhost:5173) concurrently.
  
  Other useful scripts:
    - `npm run db:up` / `npm run db:down` - start/stop the postgres container
    - `npx prisma migrate dev` - apply pending migrations to your local dev database
