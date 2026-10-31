// Eigene TipTap-Erweiterung: Blockeinzug (Einrücken) für Absätze & Überschriften.
// TipTap/StarterKit bringt keinen Einzug mit — wir hängen ein `indent`-Attribut
// (Level 0…maxLevel) an die Blocknodes und rendern es als linker Außenabstand.
// Bewusst KEIN Tab-Override (Tab gehört in Listen dem list-keymap) — der Einzug
// läuft über Toolbar-Buttons bzw. Mod-]/Mod-[.

import { Extension, type Command } from "@tiptap/core";

export interface IndentOptions {
  /** Node-Typen, die einrückbar sind. */
  types: string[];
  /** rem pro Einzugsstufe. */
  step: number;
  minLevel: number;
  maxLevel: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /** Einzug um eine Stufe erhöhen. */
      indent: () => ReturnType;
      /** Einzug um eine Stufe verringern. */
      outdent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create<IndentOptions>({
  name: "indent",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
      step: 2.5,
      minLevel: 0,
      maxLevel: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const ml = (el as HTMLElement).style.marginLeft;
              if (!ml) return 0;
              const num = parseFloat(ml);
              if (!Number.isFinite(num) || num <= 0) return 0;
              return Math.round(num / this.options.step);
            },
            renderHTML: (attrs) => {
              const level = (attrs.indent as number) || 0;
              if (!level) return {};
              return { style: `margin-left: ${level * this.options.step}rem` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const shift = (direction: 1 | -1): Command =>
      ({ tr, state, dispatch }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!this.options.types.includes(node.type.name)) return;
          const cur = (node.attrs.indent as number) || 0;
          const next = Math.min(
            this.options.maxLevel,
            Math.max(this.options.minLevel, cur + direction),
          );
          if (next !== cur) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };

    return {
      indent: () => shift(1),
      outdent: () => shift(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-]": () => this.editor.commands.indent(),
      "Mod-[": () => this.editor.commands.outdent(),
    };
  },
});
