import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { MutationScope, MutationSite, ScopeRef, SourceAnalysis } from "../model.js";
import { ManifestSupport } from "../manifest/support.js";
import { binaryOperatorFor, lineNumberAt, scriptKindFor } from "./operators.js";

export class MutationCatalog {
  private readonly manifestSupport = new ManifestSupport();

  discover(files: string[]): MutationSite[] {
    const sites: MutationSite[] = [];
    for (const file of files) {
      sites.push(...this.analyze(file).sites);
    }
    return sites.sort(compareSites);
  }

  analyze(file: string): SourceAnalysis {
    const raw = readFileSync(file, "utf8");
    const source = this.manifestSupport.stripManifest(raw);
    const scanned = scanSource(file, source, this.manifestSupport);
    return {
      sourceWithoutManifest: source,
      sites: scanned.sites.sort(compareSites),
      scopes: [...scanned.scopes].sort((left, right) => left.id.localeCompare(right.id)),
      moduleHash: this.manifestSupport.hashScopes(scanned.scopes)
    };
  }
}

function compareSites(left: MutationSite, right: MutationSite): number {
  const fileOrder = left.file.localeCompare(right.file);
  if (fileOrder !== 0) {
    return fileOrder;
  }
  return left.start - right.start;
}

function scanSource(file: string, source: string, hashing: ManifestSupport): { sites: MutationSite[]; scopes: MutationScope[] } {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const checker = createChecker(file, source, sourceFile);
  const scanner = new AstMutationScanner(file, source, sourceFile, checker, hashing);
  scanner.visit(sourceFile);
  return { sites: scanner.sites, scopes: scanner.scopes() };
}

function createChecker(file: string, source: string, sourceFile: ts.SourceFile): ts.TypeChecker {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    noEmit: true,
    strict: false,
    skipLibCheck: true,
    noLib: true,
    esModuleInterop: true
  };
  const resolved = path.resolve(file);
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (path.resolve(fileName) === resolved || fileName === file || fileName === sourceFile.fileName) {
      return sourceFile;
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };
  host.fileExists = (fileName) => path.resolve(fileName) === resolved || ts.sys.fileExists(fileName);
  host.readFile = (fileName) => (path.resolve(fileName) === resolved ? source : ts.sys.readFile(fileName));
  const program = ts.createProgram([file], options, host);
  return program.getTypeChecker();
}

class AstMutationScanner {
  readonly sites: MutationSite[] = [];
  private readonly collectedScopes: MutationScope[] = [];
  private readonly scopeStack: MutationScope[] = [];
  private readonly classNames: string[] = [];

  constructor(
    private readonly file: string,
    private readonly source: string,
    private readonly sourceFile: ts.SourceFile,
    private readonly checker: ts.TypeChecker,
    private readonly hashing: ManifestSupport
  ) {}

  scopes(): MutationScope[] {
    return this.collectedScopes;
  }

  visit(node: ts.Node): void {
    if (shouldSkipNode(node)) {
      return;
    }
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const name = node.name?.text ?? "anonymous";
      this.classNames.push(name);
      this.pushScope(this.classScope(node, name));
      this.visitChildren(node);
      this.popScope();
      this.classNames.pop();
      return;
    }
    if (isFunctionLike(node)) {
      this.pushScope(this.functionScope(node));
      this.visitChildren(node);
      this.popScope();
      return;
    }
    if (ts.isPropertyDeclaration(node)) {
      this.pushScope(this.fieldScope(node));
      this.maybeMutate(node);
      this.visitChildren(node);
      this.popScope();
      return;
    }
    if (ts.isVariableDeclaration(node) && this.isField(node)) {
      this.pushScope(this.fieldScope(node));
      this.maybeMutate(node);
      this.visitChildren(node);
      this.popScope();
      return;
    }
    this.maybeMutate(node);
    this.visitChildren(node);
  }

  private visitChildren(node: ts.Node): void {
    ts.forEachChild(node, (child) => this.visit(child));
  }

  private maybeMutate(node: ts.Node): void {
    this.maybeLiteral(node);
    this.maybeBinary(node);
    this.maybeUnary(node);
    this.maybeOptionalChain(node);
    this.maybeTernary(node);
    this.maybeJsxBooleanAttribute(node);
    this.maybeJsxElement(node);
    this.maybeNullReplacement(node);
  }

  private maybeLiteral(node: ts.Node): void {
    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      this.addReplacement(node.getStart(this.sourceFile), node.end, "true", "false");
      return;
    }
    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      this.addReplacement(node.getStart(this.sourceFile), node.end, "false", "true");
      return;
    }
    if (ts.isNumericLiteral(node) && (node.text === "0" || node.text === "1")) {
      this.addReplacement(node.getStart(this.sourceFile), node.end, node.text, node.text === "0" ? "1" : "0");
    }
  }

  private maybeBinary(node: ts.Node): void {
    if (!ts.isBinaryExpression(node)) {
      return;
    }
    const operator = binaryOperatorFor(node.operatorToken.kind);
    if (!operator) {
      return;
    }
    if (operator.numericOnly && !this.isNumericExpression(node)) {
      return;
    }
    const tokenStart = node.operatorToken.getStart(this.sourceFile);
    const tokenEnd = node.operatorToken.end;
    const original = this.source.slice(tokenStart, tokenEnd);
    if (original !== operator.original) {
      return;
    }
    this.addReplacement(tokenStart, tokenEnd, operator.original, operator.replacement);
  }

  private maybeUnary(node: ts.Node): void {
    if (!ts.isPrefixUnaryExpression(node)) {
      return;
    }
    if (node.operator === ts.SyntaxKind.ExclamationToken) {
      this.addRemovablePrefix(node, "!");
      return;
    }
    if (node.operator === ts.SyntaxKind.MinusToken && this.isNumericExpression(node)) {
      this.addRemovablePrefix(node, "-");
    }
  }

  private maybeOptionalChain(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node) && node.questionDotToken) {
      const start = node.questionDotToken.getStart(this.sourceFile);
      const end = node.questionDotToken.end;
      this.addSite(start, end, "?.", ".", "replace ?. with .");
      return;
    }
    if ((ts.isElementAccessExpression(node) || ts.isCallExpression(node)) && node.questionDotToken) {
      const start = node.questionDotToken.getStart(this.sourceFile);
      const end = node.questionDotToken.end;
      this.addSite(start, end, "?.", "", "replace ?. with removed ?.");
    }
  }

  private maybeTernary(node: ts.Node): void {
    if (!ts.isConditionalExpression(node)) {
      return;
    }
    const start = node.getStart(this.sourceFile);
    const original = this.source.slice(start, node.end);
    const condition = node.condition.getText(this.sourceFile);
    const whenTrue = node.whenTrue.getText(this.sourceFile);
    const whenFalse = node.whenFalse.getText(this.sourceFile);
    const replacement = `${condition} ? ${whenFalse} : ${whenTrue}`;
    if (replacement !== original) {
      this.addSite(start, node.end, original, replacement, "swap ternary branches");
    }
  }

  private maybeJsxBooleanAttribute(node: ts.Node): void {
    if (!ts.isJsxAttribute(node) || node.initializer) {
      return;
    }
    const start = node.getStart(this.sourceFile);
    const name = node.name.getText(this.sourceFile);
    this.addSite(start, node.end, name, `${name}={false}`, `replace ${name} with ${name}={false}`);
  }

  private maybeJsxElement(node: ts.Node): void {
    if (!isJsxNode(node)) {
      return;
    }
    const start = node.getStart(this.sourceFile);
    const original = this.source.slice(start, node.end);
    if (this.isJsxChild(node)) {
      this.addSite(start, node.end, original, "{null}", "replace JSX with {null}");
      return;
    }
    this.addSite(start, node.end, original, "null", `replace ${original} with null`);
  }

  private maybeNullReplacement(node: ts.Node): void {
    const expression = rvalueExpression(node);
    if (!expression || isJsxNode(expression) || !this.isReferenceExpression(expression)) {
      return;
    }
    const start = expression.getStart(this.sourceFile);
    const original = this.source.slice(start, expression.end);
    if (original === "null" || original === "undefined") {
      return;
    }
    this.addSite(start, expression.end, original, "null", `replace ${original} with null`);
  }

  private addRemovablePrefix(node: ts.PrefixUnaryExpression, operator: string): void {
    const start = skipWhitespace(this.source, node.getStart(this.sourceFile));
    if (!this.source.startsWith(operator, start)) {
      return;
    }
    this.addSite(start, start + operator.length, operator, "", `replace ${operator} with removed ${operator}`);
  }

  private addReplacement(start: number, end: number, original: string, replacement: string): void {
    this.addSite(start, end, original, replacement, `replace ${original} with ${replacement}`);
  }

  private addSite(start: number, end: number, original: string, replacement: string, description: string): void {
    const scope = this.currentScope(start);
    this.sites.push({
      file: this.file,
      lineNumber: lineNumberAt(this.sourceFile, start),
      start,
      end,
      originalText: original,
      replacementText: replacement,
      description,
      scopeId: scope.id,
      scopeKind: scope.kind,
      scopeStartLine: scope.startLine,
      scopeEndLine: scope.endLine
    });
  }

  private pushScope(scope: MutationScope): void {
    this.addScope(scope);
    this.scopeStack.push(scope);
  }

  private popScope(): void {
    this.scopeStack.pop();
  }

  private addScope(scope: MutationScope): void {
    if (!this.collectedScopes.some((existing) => existing.id === scope.id)) {
      this.collectedScopes.push(scope);
    }
  }

  private classScope(node: ts.ClassDeclaration | ts.ClassExpression, name: string): MutationScope {
    return this.scopeFromNode(`class:${this.qualified(name)}:${this.startLine(node)}`, "class", node);
  }

  private functionScope(node: ts.FunctionLikeDeclaration): MutationScope {
    const name = functionName(node);
    const kind = ts.isConstructorDeclaration(node) ? "method" : ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node) ? "method" : "function";
    const idName = ts.isConstructorDeclaration(node) ? "ctor" : name;
    return this.scopeFromNode(
      `${kind}:${this.qualified(idName)}(${node.parameters.length}):${this.startLine(node)}`,
      kind,
      node
    );
  }

  private fieldScope(node: ts.VariableDeclaration | ts.PropertyDeclaration): MutationScope {
    const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(this.sourceFile);
    return this.scopeFromNode(`field:${this.qualified(name)}:${this.startLine(node)}`, "field", node);
  }

  private scopeFromNode(id: string, kind: string, node: ts.Node): MutationScope {
    const start = Math.max(0, node.getStart(this.sourceFile));
    const end = Math.max(start + 1, node.end);
    return {
      id,
      kind,
      startLine: lineNumberAt(this.sourceFile, start),
      endLine: lineNumberAt(this.sourceFile, Math.max(start, end - 1)),
      semanticHash: this.hashing.hash(this.source.slice(start, end))
    };
  }

  private currentScope(_position: number): ScopeRef {
    const scope = this.scopeStack[this.scopeStack.length - 1];
    if (scope) {
      return scope;
    }
    return {
      id: `file:${path.basename(this.file)}`,
      kind: "file",
      startLine: 1,
      endLine: lineNumberAt(this.sourceFile, this.source.length)
    };
  }

  private qualified(detail: string): string {
    const prefix = this.classNames.join(".");
    return prefix ? `${prefix}#${detail}` : detail;
  }

  private startLine(node: ts.Node): number {
    return lineNumberAt(this.sourceFile, Math.max(0, node.getStart(this.sourceFile)));
  }

  private isField(node: ts.VariableDeclaration): boolean {
    const statement = node.parent?.parent;
    return (ts.isPropertyDeclaration(node.parent) || false)
      || (!!statement && ts.isVariableStatement(statement) && this.classNames.length > 0 && isClassMember(statement.parent));
  }

  private isNumericExpression(node: ts.Expression): boolean {
    if (this.isStringy(node)) {
      return false;
    }
    const type = this.checker.getTypeAtLocation(node);
    if (isNumericType(type)) {
      return true;
    }
    if (ts.isBinaryExpression(node)) {
      return this.isNumericExpression(node.left) && this.isNumericExpression(node.right) && !this.isStringy(node.left) && !this.isStringy(node.right);
    }
    if (ts.isPrefixUnaryExpression(node)) {
      return this.isNumericExpression(node.operand);
    }
    if (ts.isNumericLiteral(node) || ts.isBigIntLiteral(node)) {
      return true;
    }
    if (ts.isParenthesizedExpression(node)) {
      return this.isNumericExpression(node.expression);
    }
    return false;
  }

  private isStringy(node: ts.Expression): boolean {
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return true;
    }
    if (ts.isParenthesizedExpression(node)) {
      return this.isStringy(node.expression);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return this.isStringy(node.left) || this.isStringy(node.right);
    }
    const type = this.checker.getTypeAtLocation(node);
    return isStringType(type);
  }

  private isReferenceExpression(node: ts.Expression): boolean {
    if (node.kind === ts.SyntaxKind.ThisKeyword || node.kind === ts.SyntaxKind.SuperKeyword) {
      return false;
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    }
    if (ts.isNumericLiteral(node) || ts.isBigIntLiteral(node) || ts.isPrefixUnaryExpression(node) && this.isNumericExpression(node)) {
      return false;
    }
    const type = this.checker.getTypeAtLocation(node);
    if (isNumericType(type) || isBooleanType(type) || isVoidLike(type)) {
      return false;
    }
    return true;
  }

  private isJsxChild(node: ts.Node): boolean {
    const parent = node.parent;
    return !!parent && (ts.isJsxElement(parent) || ts.isJsxFragment(parent));
  }
}

function shouldSkipNode(node: ts.Node): boolean {
  return ts.isInterfaceDeclaration(node)
    || ts.isTypeAliasDeclaration(node)
    || ts.isTypeParameterDeclaration(node)
    || ts.isImportDeclaration(node)
    || (ts.isExportDeclaration(node) && !!node.moduleSpecifier)
    || ts.isImportEqualsDeclaration(node)
    || (ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node));
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node);
}

function functionName(node: ts.FunctionLikeDeclaration): string {
  if (node.name && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  if (ts.isConstructorDeclaration(node)) {
    return "ctor";
  }
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (ts.isPropertyDeclaration(parent) && parent.name && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  return "anonymous";
}

function isClassMember(node: ts.Node | undefined): boolean {
  return !!node && (ts.isClassDeclaration(node) || ts.isClassExpression(node));
}

function isJsxNode(node: ts.Node): node is ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
}

function rvalueExpression(node: ts.Node): ts.Expression | undefined {
  if (ts.isReturnStatement(node) && node.expression) {
    return node.expression;
  }
  if (ts.isPropertyDeclaration(node) && node.initializer) {
    return node.initializer;
  }
  if (ts.isVariableDeclaration(node) && node.initializer) {
    return node.initializer;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    return node.right;
  }
  if (ts.isJsxExpression(node) && node.expression && !node.dotDotDotToken) {
    return node.expression;
  }
  if (ts.isExportAssignment(node) && !node.isExportEquals) {
    return node.expression;
  }
  return undefined;
}

function skipWhitespace(source: string, start: number): number {
  let index = start;
  while (index < source.length && /\s/.test(source[index]!)) {
    index += 1;
  }
  return index;
}

function isNumericType(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BigInt | ts.TypeFlags.BigIntLiteral | ts.TypeFlags.EnumLike)) !== 0;
}

function isBooleanType(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) !== 0;
}

function isStringType(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral | ts.TypeFlags.TemplateLiteral)) !== 0;
}

function isVoidLike(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Never)) !== 0;
}
