# Beginner Guide: Build a Word-Style DOCX App

This guide shows how to build a small Microsoft Word-style web app with your current project:

- **Next.js 16** for the application
- **React** for interactive components
- **TypeScript** for safer code
- **Tiptap** for the document editor
- **shadcn/ui** for customizable menus and buttons
- **Tailwind CSS** for layout and styling
- **`docx`** for exporting Word files
- **Mammoth.js** for importing Word files

The goal is to build a simple working editor first. More advanced features come later.

---

## 1. Understand the Parts Before Coding

A Word-style app has several separate responsibilities:

1. **The page** displays the application.
2. **The editor** stores and displays formatted text.
3. **The toolbar** sends commands to the editor, such as bold or italic.
4. **The database** saves documents so they are still available later.
5. **Import and export code** converts between your editor content and `.docx` files.

It is useful to keep these responsibilities separate. For example, the toolbar should not contain database code.

### Important idea: client components

Your `app/page.tsx` file is a Server Component by default. Tiptap needs browser features such as clicks, selections, and keyboard input. Therefore, the component that uses Tiptap must begin with:

```tsx
"use client";
```

This tells Next.js that the component runs in the browser and can use interactive React features.

---

## 2. Install the Editor Packages

Open a terminal in the project folder and run:

```bash
npm install @tiptap/react @tiptap/starter-kit \
  @tiptap/extension-underline \
  @tiptap/extension-text-align \
  @tiptap/extension-text-style \
  @tiptap/extension-color \
  docx file-saver mammoth
```

On Windows PowerShell, use one line if the multiline command gives you trouble:

```powershell
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-text-style @tiptap/extension-color docx file-saver mammoth
```

### What each package does

- `@tiptap/react`: React components and hooks for Tiptap.
- `@tiptap/starter-kit`: common editor features such as paragraphs, headings, bold, italic, lists, and undo.
- `underline`: adds underlined text.
- `text-align`: adds left, center, right, and justified alignment.
- `text-style` and `color`: support text styling and colors.
- `docx`: creates Microsoft Word files.
- `file-saver`: downloads generated files in the browser.
- `mammoth`: converts basic `.docx` files to HTML for importing.

### Checkpoint

Run:

```bash
npm run lint
```

The command should finish without package-related errors.

---

## 3. Add shadcn/ui

Initialize shadcn/ui from the project root:

```bash
npx shadcn@latest init
```

Answer the setup questions using the defaults unless your project asks for a specific choice.

Then install the components needed by the toolbar:

```bash
npx shadcn@latest add button separator dropdown-menu tooltip
```

### What shadcn/ui is

shadcn/ui is not a normal component library that hides everything inside a package. It copies component source code into your project, usually under `components/ui`.

That means you can open and customize the components yourself. This is useful for a Word-style application because you will eventually need custom menus for:

- Font family
- Font size
- Text color
- Highlight color
- Paragraph style
- Alignment
- Tables
- Insert image

### Checkpoint

You should now see a `components/ui` folder. If it is not created, check the command output and run the initialization again.

---

## 4. Create the Editor Component

Create this file:

```text
components/editor/document-editor.tsx
```

Add:

```tsx
"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";

export function DocumentEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: `
      <h1>My first document</h1>
      <p>Start writing here. This text can be formatted with the toolbar.</p>
    `,
    immediatelyRender: false,
  });

  if (!editor) {
    return <p>Loading editor...</p>;
  }

  return <EditorContent editor={editor} />;
}
```

### Learn what is happening

- `useEditor` creates the Tiptap editor instance.
- `extensions` defines which editor features are enabled.
- `content` provides the initial document.
- `EditorContent` renders the editable area.
- `immediatelyRender: false` helps prevent a server/client rendering mismatch in Next.js.
- `editor` can be `null` while the editor is loading, so the component checks it before rendering.

### Checkpoint

At this point, the editor exists, but it will not look like a sheet of paper yet. The next steps add the page and toolbar around it.

---

## 5. Create the Toolbar

Create:

```text
components/editor/editor-toolbar.tsx
```

Add:

```tsx
"use client";

import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type EditorToolbarProps = {
  editor: Editor;
};

export function EditorToolbar({ editor }: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-2">
      <Button
        type="button"
        variant={editor.isActive("bold") ? "secondary" : "ghost"}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        Bold
      </Button>

      <Button
        type="button"
        variant={editor.isActive("italic") ? "secondary" : "ghost"}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        Italic
      </Button>

      <Button
        type="button"
        variant={editor.isActive("underline") ? "secondary" : "ghost"}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        Underline
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        type="button"
        variant="ghost"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        Left
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        Center
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        Right
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        type="button"
        variant="ghost"
        onClick={() => editor.chain().focus().undo().run()}
      >
        Undo
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={() => editor.chain().focus().redo().run()}
      >
        Redo
      </Button>
    </div>
  );
}
```

### Learn what is happening

This pattern is central to the application:

```tsx
editor.chain().focus().toggleBold().run()
```

It means:

1. `editor` accesses the current editor.
2. `chain()` starts a group of editor commands.
3. `focus()` puts the cursor back in the document.
4. `toggleBold()` applies or removes bold formatting.
5. `run()` executes the command.

`editor.isActive("bold")` checks whether the cursor is currently inside bold text. That lets the button show an active state.

### Checkpoint

The toolbar should render buttons. Clicking Bold, Italic, or Underline should change the selected text.

---

## 6. Connect the Toolbar and Editor

Update `components/editor/document-editor.tsx` so it imports and renders the toolbar:

```tsx
"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { EditorToolbar } from "@/components/editor/editor-toolbar";

export function DocumentEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: `
      <h1>My first document</h1>
      <p>Start writing here. This text can be formatted with the toolbar.</p>
    `,
    immediatelyRender: false,
  });

  if (!editor) {
    return <p>Loading editor...</p>;
  }

  return (
    <div>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

The editor component owns the editor instance and passes it to the toolbar. This is called **passing props** in React.

---

## 7. Add the Editor to the Home Page

Replace the contents of `app/page.tsx` with:

```tsx
import { DocumentEditor } from "@/components/editor/document-editor";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border bg-white shadow-sm">
        <header className="border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Untitled document</h1>
        </header>

        <DocumentEditor />
      </div>
    </main>
  );
}
```

You can remove the unused `Image` import from the starter file.

### Start the development server

```bash
npm run dev
```

Open `http://localhost:3000`.

### Checkpoint

You should be able to:

- See the title and editor.
- Type text.
- Select text and apply bold, italic, or underline.
- Align a paragraph.
- Undo and redo changes.

If the page is blank, inspect the terminal and browser console. Common causes are an incorrect import path or a missing shadcn component.

---

## 8. Make the Document Look Like a Page

Add editor styling to `app/globals.css`:

```css
.tiptap {
  min-height: 650px;
  padding: 3rem;
  outline: none;
}

.tiptap h1 {
  margin-bottom: 1rem;
  font-size: 2rem;
  font-weight: 700;
}

.tiptap h2 {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.tiptap p {
  margin: 0.75rem 0;
  line-height: 1.7;
}

.tiptap ul {
  list-style: disc;
  padding-left: 1.5rem;
}

.tiptap ol {
  list-style: decimal;
  padding-left: 1.5rem;
}

.tiptap blockquote {
  border-left: 3px solid #cbd5e1;
  padding-left: 1rem;
  color: #475569;
}
```

### Why this CSS is separate

Tiptap creates normal HTML elements such as `h1`, `p`, `ul`, and `blockquote`. The `.tiptap` selector limits these styles to the document editor so they do not accidentally change the rest of your application.

---

## 9. Add Headings and Lists

`StarterKit` already includes headings and lists. Add these buttons inside the toolbar:

```tsx
<Button
  type="button"
  variant="ghost"
  onClick={() =>
    editor.chain().focus().toggleHeading({ level: 1 }).run()
  }
>
  Heading 1
</Button>

<Button
  type="button"
  variant="ghost"
  onClick={() => editor.chain().focus().toggleBulletList().run()}
>
  Bullet list
</Button>

<Button
  type="button"
  variant="ghost"
  onClick={() => editor.chain().focus().toggleOrderedList().run()}
>
  Numbered list
</Button>
```

The button calls a Tiptap command. The command changes the current paragraph or selected content.

A future improvement is to replace text labels with icons from `lucide-react`:

```bash
npm install lucide-react
```

Example:

```tsx
import { Bold } from "lucide-react";

<Button size="icon" variant="ghost" aria-label="Bold">
  <Bold />
</Button>
```

Keep `aria-label` on icon-only buttons so keyboard and screen-reader users can understand them.

---

## 10. Understand How Document Data Works

Tiptap can return the document in two useful formats:

```tsx
const json = editor.getJSON();
const html = editor.getHTML();
```

Use JSON as your main saved format:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Hello"
        }
      ]
    }
  ]
}
```

### Why save JSON?

JSON preserves the editor structure. When you reload the document, Tiptap can recreate headings, paragraphs, lists, and formatting from that structure.

HTML is useful for displaying or converting content, but it is less convenient as the primary editor format.

---

## 11. Add Local Autosave Before Adding a Database

Before learning authentication and databases, practice saving locally in the browser.

Inside `DocumentEditor`, import `useEffect`:

```tsx
import { useEffect } from "react";
```

Add an editor event listener after the editor is created:

```tsx
useEffect(() => {
  if (!editor) return;

  const saveDraft = () => {
    localStorage.setItem(
      "word-app-draft",
      JSON.stringify(editor.getJSON()),
    );
  };

  editor.on("update", saveDraft);

  return () => {
    editor.off("update", saveDraft);
  };
}, [editor]);
```

Then load the draft when creating the editor:

```tsx
const savedContent =
  typeof window !== "undefined"
    ? localStorage.getItem("word-app-draft")
    : null;

const editor = useEditor({
  extensions: [StarterKit, Underline, TextAlign.configure({ types: ["heading", "paragraph"] })],
  content: savedContent ? JSON.parse(savedContent) : "<p>Start writing...</p>",
  immediatelyRender: false,
});
```

### What this teaches

- `localStorage` is browser storage.
- The `update` event runs when the document changes.
- `useEffect` connects and disconnects event listeners.
- This is a prototype only. A real app should save to a server database.

### Checkpoint

Type text, refresh the page, and confirm that the draft returns.

---

## 12. Export a Simple DOCX File

Create:

```text
lib/export-docx.ts
```

Start with a simple export function:

```ts
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

export async function exportDocx() {
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "My document",
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [new TextRun("Document content goes here.")],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(document);
}
```

Create a client button:

```tsx
"use client";

import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { exportDocx } from "@/lib/export-docx";

export function ExportButton() {
  async function handleExport() {
    const blob = await exportDocx();
    saveAs(blob, "my-document.docx");
  }

  return (
    <Button type="button" onClick={handleExport}>
      Export DOCX
    </Button>
  );
}
```

### Important limitation

The example exports fixed text. To export the actual Tiptap document, you must write a converter that walks through Tiptap JSON and creates matching `docx` objects.

The conversion idea is:

- Tiptap `heading` becomes a `docx` heading paragraph.
- Tiptap `paragraph` becomes a normal paragraph.
- Tiptap `text` becomes a `TextRun`.
- Tiptap `bulletList` becomes bullet paragraphs.
- Tiptap `orderedList` becomes numbered paragraphs.
- Tiptap `table` becomes a DOCX table.

Build one node type at a time and test each one.

---

## 13. Import a DOCX File

Mammoth.js can turn a basic Word file into HTML. Create:

```text
lib/import-docx.ts
```

```ts
import mammoth from "mammoth";

export async function importDocx(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}
```

Then use it in a client component with a file input:

```tsx
"use client";

import { importDocx } from "@/lib/import-docx";

export function ImportButton({
  onContentImported,
}: {
  onContentImported: (html: string) => void;
}) {
  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    const html = await importDocx(file);
    onContentImported(html);
  }

  return (
    <label>
      Import DOCX
      <input
        type="file"
        accept=".docx"
        onChange={handleFileChange}
        className="sr-only"
      />
    </label>
  );
}
```

The parent component can load the returned HTML into Tiptap:

```tsx
editor.commands.setContent(html);
```

### Import limitation

Mammoth focuses on readable HTML. It may not preserve every Word feature, such as exact page layouts, advanced headers, tracked changes, or complex styles.

If exact Word compatibility is a main requirement, research **ONLYOFFICE Docs** instead of building the editor from scratch.

---

## 14. Add a Database Later

Once the editor and local autosave work, add a database. Supabase is a beginner-friendly option because it provides PostgreSQL, authentication, and an API.

A document table should contain fields similar to:

```text
id          unique document ID
owner_id    user who owns the document
title       document name
content     Tiptap JSON
created_at  creation time
updated_at  last save time
```

A basic save flow is:

1. The user types.
2. The editor produces JSON.
3. You wait briefly so you do not save on every keystroke.
4. The client sends the JSON to a Next.js route or server action.
5. The server validates the user.
6. The server saves the document.

Do not put secret database keys in a client component. Server-only keys belong in server code and environment variables.

---

## 15. Suggested Folder Structure

As the application grows, use this structure:

```text
app/
  page.tsx
  editor/
    page.tsx
  api/
    documents/
      route.ts
components/
  editor/
    document-editor.tsx
    editor-toolbar.tsx
    export-button.tsx
    import-button.tsx
  ui/
    button.tsx
    dropdown-menu.tsx
lib/
  editor/
    export-docx.ts
    import-docx.ts
  db.ts
public/
  icons/
```

### What belongs where

- `app`: routes and page-level layouts.
- `components/editor`: reusable editor interface pieces.
- `components/ui`: shadcn/ui components.
- `lib/editor`: editor conversion and document utilities.
- `lib/db.ts`: database connection code.
- `app/api`: server endpoints for document operations.

---

## 16. Build in This Order

Complete each milestone before starting the next one:

### Milestone 1: typing

- Install Tiptap.
- Render an editable paragraph.
- Type and delete text.

### Milestone 2: formatting

- Add bold, italic, underline.
- Add headings and lists.
- Add alignment.
- Add undo and redo.

### Milestone 3: user interface

- Add shadcn buttons.
- Add dropdown menus.
- Add tooltips and keyboard-friendly labels.
- Add a document title.

### Milestone 4: persistence

- Save JSON to `localStorage`.
- Add a saved status such as `Saving...` and `Saved`.
- Add a database only after local saving works.

### Milestone 5: files

- Export a basic DOCX.
- Convert paragraphs and headings.
- Add lists and tables.
- Import basic DOCX files.

### Milestone 6: collaboration features

- User accounts.
- Multiple documents.
- Sharing permissions.
- Comments.
- Version history.

---

## 17. Common Beginner Errors

### `Module not found: '@/components/ui/button'`

The shadcn Button component has not been generated or the import alias is not configured. Run:

```bash
npx shadcn@latest add button
```

Then check that `components/ui/button.tsx` exists.

### `window is not defined`

A browser-only API such as `window` or `localStorage` is being used in server code. Put the code in a client component and access it inside an event handler or `useEffect`.

### The editor renders twice or shows a hydration warning

Confirm that the Tiptap component has `"use client"` and that `useEditor` includes:

```tsx
immediatelyRender: false
```

### A toolbar button does nothing

Check these three things:

1. The required Tiptap extension is included.
2. The command is supported by that extension.
3. The button calls `.run()` at the end.

### DOCX import loses formatting

This is a conversion limitation. Start with simple paragraphs and headings. Complex Word layouts need a more powerful document engine.

---

## 18. Useful Commands

Start development:

```bash
npm run dev
```

Check lint errors:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Stop the development server with `Ctrl+C` in the terminal.

Run lint and build after completing each milestone. Fix errors before adding the next feature.

---

## 19. Recommended Learning Habit

For every new feature, follow this cycle:

1. Read what the feature is responsible for.
2. Create the smallest working version.
3. Test it in the browser.
4. Change one thing and observe what happens.
5. Run `npm run lint`.
6. Write down what you learned.

Do not begin with every Word feature at once. A small editor that types, formats, saves, and exports is a better foundation than a large interface with untested buttons.

## Final Recommendation

Start with **Tiptap + shadcn/ui** if your priority is learning and customizing the interface. Use **ONLYOFFICE Docs** if your priority is editing real Word documents with maximum Microsoft Word compatibility.

For this project, build the Tiptap version first. It will teach you React state, client components, editor commands, reusable UI, file conversion, and database persistence in a manageable order.
