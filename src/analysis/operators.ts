import ts from "typescript";

export interface BinaryMutationOperator {
  original: string;
  replacement: string;
  numericOnly: boolean;
}

export function binaryOperatorFor(kind: ts.SyntaxKind): BinaryMutationOperator | undefined {
  switch (kind) {
    case ts.SyntaxKind.PlusToken:
      return { original: "+", replacement: "-", numericOnly: true };
    case ts.SyntaxKind.MinusToken:
      return { original: "-", replacement: "+", numericOnly: false };
    case ts.SyntaxKind.AsteriskToken:
      return { original: "*", replacement: "/", numericOnly: false };
    case ts.SyntaxKind.SlashToken:
      return { original: "/", replacement: "*", numericOnly: false };
    case ts.SyntaxKind.AmpersandAmpersandToken:
      return { original: "&&", replacement: "||", numericOnly: false };
    case ts.SyntaxKind.BarBarToken:
      return { original: "||", replacement: "&&", numericOnly: false };
    case ts.SyntaxKind.QuestionQuestionToken:
      return { original: "??", replacement: "||", numericOnly: false };
    case ts.SyntaxKind.EqualsEqualsToken:
      return { original: "==", replacement: "!=", numericOnly: false };
    case ts.SyntaxKind.ExclamationEqualsToken:
      return { original: "!=", replacement: "==", numericOnly: false };
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
      return { original: "===", replacement: "!==", numericOnly: false };
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      return { original: "!==", replacement: "===", numericOnly: false };
    case ts.SyntaxKind.GreaterThanToken:
      return { original: ">", replacement: ">=", numericOnly: false };
    case ts.SyntaxKind.GreaterThanEqualsToken:
      return { original: ">=", replacement: ">", numericOnly: false };
    case ts.SyntaxKind.LessThanToken:
      return { original: "<", replacement: "<=", numericOnly: false };
    case ts.SyntaxKind.LessThanEqualsToken:
      return { original: "<=", replacement: "<", numericOnly: false };
    default:
      return undefined;
  }
}

export function scriptKindFor(file: string): ts.ScriptKind {
  const lower = file.toLowerCase();
  if (lower.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (lower.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

export function lineNumberAt(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}
