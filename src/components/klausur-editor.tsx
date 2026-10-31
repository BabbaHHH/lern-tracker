"use client";

// Minimalistischer Klausur-Schreib-Editor (TipTap), angelehnt an LPLUS Studio:
// reduzierte Toolbar, ruhige Schreibfläche, Autosave wird vom Parent gesteuert.

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import TextAlign from "@tiptap/extension-text-align";
import { Indent } from "@/lib/tiptap-indent";
import { useEffect } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, IndentIncrease, IndentDecrease,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KlausurEditorProps {
  initialContent: string;
  /** Accessible name for the account writing surface; browser defaults remain unchanged. */
  label?: string;
  onUpdate: (html: string, text: string) => void;
  /** Reicht die TipTap-Editor-Instanz nach oben (Selektion, Caret, Counts). */
  onReady?: (editor: Editor) => void;
}

function ToolbarButton({
  active, onClick, title, children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-8 w-8 flex items-center justify-center border border-transparent text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900",
        active && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export function KlausurEditor({ initialContent, onUpdate, onReady, label }: KlausurEditorProps) {
  const editor = useEditor({
    immediatelyRender: false, // TipTap-SSR-Gotcha in Next
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      CharacterCount,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
      }),
      Indent,
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        ...(label ? { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true' } : {}),
        class:
          "prose prose-slate max-w-none min-h-[60vh] focus:outline-none font-serif text-[15px] leading-relaxed px-6 py-5",
      },
    },
    onUpdate: ({ editor }) => onUpdate(editor.getHTML(), editor.getText()),
  });

  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  if (!editor) {
    return <div className="min-h-[60vh] animate-pulse bg-slate-50" />;
  }

  return (
    <div className="flex flex-col border border-slate-200 bg-white">
      <div className="flex items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">
        <ToolbarButton title="Überschrift" active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Unterüberschrift" active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton title="Fett" active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Kursiv" active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Unterstrichen" active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton title="Aufzählung" active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Nummerierte Liste" active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton title="Linksbündig" active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Zentriert" active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Rechtsbündig" active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton title="Einzug verringern (⌘[)"
          onClick={() => editor.chain().focus().outdent().run()}>
          <IndentDecrease className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Einrücken (⌘])"
          onClick={() => editor.chain().focus().indent().run()}>
          <IndentIncrease className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
