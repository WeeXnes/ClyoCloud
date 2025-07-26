# ClyoCloud

ClyoCloud is a modern, open-source file sharing platform built with Nuxt.js and Tailwind CSS. It provides a simple and intuitive interface for uploading, managing, and sharing files.

## Features

*   **File Upload:** Upload files with a simple drag-and-drop interface.
*   **File Management:** View, rename, and delete files.
*   **File Sharing:** Generate shareable links for files.
*   **User Authentication:** Secure user authentication with JWT.
*   **Responsive Design:** A fully responsive design that works on all devices.
*   **Dark Mode:** A beautiful dark mode for late-night file browsing.
*   **File Previews:** Previews for common file types and thumbnail generation for images.
*   **Notifications:** In-app notifications for various actions.

## Technologies Used

*   **Core Framework:** [Nuxt.js](https://nuxt.com/)
*   **Backend Engine:** [Nitro](https://nitro.unjs.io/) (Nuxt's built-in server)
*   **UI:** [Tailwind CSS](https://tailwindcss.com/) with the [DaisyUI](https://daisyui.com/) component library
*   **Icons:** [Nuxt Icon](https://nuxt.com/modules/icon)
*   **Authentication:** [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
*   **File Handling:** [formidable](https://github.com/node-formidable/formidable) for uploads
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Sass](https://sass-lang.com/)

## Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

*   Node.js (LTS version recommended)
*   npm (Node Package Manager) or Yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://git.weexnes.dev/WeeXnes/clyocloud
    cd clyocloud
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
    or
    ```bash
    yarn install
    ```

### Configuration

Create a `.env` file in the root directory of the project and add the following environment variables:

```
STORAGE_PATH=/path/to/your/storage
THUMBNAIL_PATH=/path/to/your/thumbnails
```

**Note:** The `maxFileSize` is set in `nuxt.config.ts` and is currently configured to 500MB.

### Running the Development Server

```bash
npm run dev
```
or
```bash
yarn dev
```

This will start the development server at `http://localhost:3000`.

### Building for Production

To build the application for production:

```bash
npm run build
```
or
```bash
yarn build
```

To preview the production build locally:

```bash
npm run preview
```
or
```bash
yarn preview
```

## Project Structure

```
.
├── app.vue                 # Main Vue application entry
├── nuxt.config.ts          # Nuxt.js configuration
├── package.json            # Project dependencies and scripts
├── tailwind.config.js      # Tailwind CSS configuration
├── components/             # Vue components
├── core/                   # Core utilities and global configurations
├── middleware/             # Nuxt middleware
├── pages/                  # Vue pages/routes
├── public/                 # Static assets
├── server/                 # Backend API routes, models, and plugins
│   ├── api/                # API endpoints
│   ├── models/             # Data models
│   ├── plugins/            # Server-side plugins
│   └── routes/             # Server-side routes
└── types/                  # TypeScript types
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the **MIT License**.