# JP Filler

## English

A Chrome extension that automatically fills out job application forms with your saved profile data.

Store your personal information once (name, email, phone, LinkedIn, GitHub, years of experience, work authorization, visa sponsorship status, and cover letter) and the extension will detect and populate form fields on any job application page. It uses fuzzy pattern matching on field labels, attributes, and surrounding text to identify the right inputs — including text fields, dropdowns, and radio buttons.

Built with Next.js and React. The popup UI lets you manage your profile with auto-save to Chrome storage.

### Setup

1. Install dependencies: `npm install`
2. Build the extension: `npm run build`
3. Load the `out/` folder as an unpacked extension in Chrome (`chrome://extensions`)
4. Edit `public/config.json` with your personal data (used as defaults)

---

## Español

Una extensión de Chrome que completa automáticamente formularios de solicitudes de empleo con tus datos de perfil guardados.

Guardá tu información personal una sola vez (nombre, email, teléfono, LinkedIn, GitHub, años de experiencia, autorización de trabajo, necesidad de sponsorship y carta de presentación) y la extensión detectará y completará los campos del formulario en cualquier página de aplicación laboral. Utiliza coincidencia difusa sobre etiquetas, atributos y texto cercano para identificar los campos correctos — incluyendo inputs de texto, desplegables y botones de opción.

Desarrollada con Next.js y React. El popup de la extensión permite gestionar tu perfil con guardado automático en el almacenamiento de Chrome.

### Instalación

1. Instalar dependencias: `npm install`
2. Compilar la extensión: `npm run build`
3. Cargar la carpeta `out/` como extensión desempaquetada en Chrome (`chrome://extensions`)
4. Editar `public/config.json` con tus datos personales (se usan como valores por defecto)
