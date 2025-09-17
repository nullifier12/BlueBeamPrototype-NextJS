# BlueBeam Prototype

A Bluebeam-like PDF annotation and collaboration tool built with Next.js, React, and TypeScript.

## Features

- **PDF Viewing**: View PDF documents with zoom, rotation, and page navigation
- **Annotation Tools**: Create highlights, text annotations, shapes, measurements, and more
- **Document Management**: Upload, organize, and manage PDF documents
- **Collaboration**: Share annotations and collaborate on documents
- **Modern UI**: Clean, professional interface inspired by Bluebeam Revu

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **PDF Handling**: react-pdf with PDF.js
- **UI Components**: Custom components with Lucide React icons
- **State Management**: React hooks and context

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd blue-beam-prototype
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Main application page
│   └── globals.css     # Global styles
├── components/         # React components
│   ├── Toolbar.tsx     # Main toolbar with annotation tools
│   ├── DocumentList.tsx # Document sidebar
│   ├── PDFViewer.tsx   # PDF viewing component
│   └── AnnotationPanel.tsx # Annotation management panel
├── types/              # TypeScript type definitions
│   └── pdf.ts          # PDF and annotation types
└── utils/              # Utility functions
    ├── cn.ts           # Class name utility
    └── currencyFormatter.ts # Currency formatting
```

## Key Components

### Toolbar
- File operations (upload, download, save)
- Edit operations (undo, redo)
- View controls (zoom, rotate)
- Annotation tools (highlight, text, shapes, etc.)

### DocumentList
- Browse and select documents
- Document metadata display
- Upload functionality
- Document organization

### PDFViewer
- PDF rendering with react-pdf
- Annotation overlay system
- Zoom and rotation controls
- Page navigation

### AnnotationPanel
- List and manage annotations
- Search and filter annotations
- Annotation editing and deletion
- User attribution

## Annotation Types

- **Highlight**: Text highlighting with color options
- **Text**: Text boxes with customizable styling
- **Sticky Notes**: Pop-up note annotations
- **Shapes**: Rectangles, circles, lines, arrows
- **Measurements**: Dimension and measurement tools
- **Cloud**: Cloud markup for revisions
- **Freehand**: Free-form drawing

## Customization

The application uses CSS custom properties for theming. You can customize colors by modifying the variables in `globals.css`:

```css
:root {
  --primary: #0066cc;
  --secondary: #f5f5f5;
  --accent: #4a90e2;
  /* ... other color variables */
}
```

## Development

### Adding New Annotation Types

1. Add the new type to `AnnotationType` in `types/pdf.ts`
2. Add the tool to the tools array in `Toolbar.tsx`
3. Implement the annotation rendering in `PDFViewer.tsx`
4. Add styling for the annotation type in `globals.css`

### Extending Functionality

- **Collaboration**: Add real-time updates with WebSocket or Server-Sent Events
- **Storage**: Integrate with cloud storage providers (AWS S3, Google Drive)
- **Authentication**: Add user authentication and authorization
- **Export**: Add PDF export with annotations embedded

## License

This project is for demonstration purposes. Please ensure you have proper licenses for any commercial use.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Acknowledgments

- Inspired by Bluebeam Revu
- Built with modern web technologies
- Uses PDF.js for PDF rendering
- Icons from Lucide React
