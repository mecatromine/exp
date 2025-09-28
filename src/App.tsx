import React, { useState, useCallback, useMemo } from 'react';

// SysML v2 Token Types
const TokenType = {
  KEYWORD: 'keyword',
  IDENTIFIER: 'identifier',
  STRING: 'string',
  NUMBER: 'number',
  OPERATOR: 'operator',
  PUNCTUATION: 'punctuation',
  COMMENT: 'comment',
  WHITESPACE: 'whitespace',
  EOF: 'eof'
};

// SysML v2 Keywords
const KEYWORDS = new Set([
  'package', 'part', 'attribute', 'port', 'connection', 'interface',
  'block', 'requirement', 'constraint', 'activity', 'state', 'transition',
  'use', 'case', 'actor', 'subject', 'stakeholder', 'concern',
  'view', 'viewpoint', 'rendering', 'expose', 'import', 'private', 'protected', 'public',
  'abstract', 'readonly', 'derived', 'end', 'redefines', 'specializes', 'conjugates'
]);

// Tokenizer for SysML v2
class SysMLTokenizer {
  constructor(text) {
    this.text = text;
    this.position = 0;
    this.line = 1;
    this.column = 1;
  }

  current() {
    return this.position < this.text.length ? this.text[this.position] : null;
  }

  peek(offset = 1) {
    const pos = this.position + offset;
    return pos < this.text.length ? this.text[pos] : null;
  }

  advance() {
    if (this.current() === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.position++;
  }

  skipWhitespace() {
    while (this.current() && /\s/.test(this.current())) {
      this.advance();
    }
  }

  readString() {
    let value = '';
    const quote = this.current();
    this.advance(); // Skip opening quote
    
    while (this.current() && this.current() !== quote) {
      if (this.current() === '\\') {
        this.advance();
        if (this.current()) {
          value += this.current();
          this.advance();
        }
      } else {
        value += this.current();
        this.advance();
      }
    }
    
    if (this.current() === quote) {
      this.advance(); // Skip closing quote
    }
    
    return value;
  }

  readNumber() {
    let value = '';
    while (this.current() && /[\d.]/.test(this.current())) {
      value += this.current();
      this.advance();
    }
    return parseFloat(value);
  }

  readIdentifier() {
    let value = '';
    while (this.current() && /[a-zA-Z0-9_]/.test(this.current())) {
      value += this.current();
      this.advance();
    }
    return value;
  }

  readComment() {
    let value = '';
    if (this.current() === '/' && this.peek() === '/') {
      while (this.current() && this.current() !== '\n') {
        value += this.current();
        this.advance();
      }
    } else if (this.current() === '/' && this.peek() === '*') {
      this.advance(); // Skip /*
      this.advance();
      while (this.current() && !(this.current() === '*' && this.peek() === '/')) {
        value += this.current();
        this.advance();
      }
      if (this.current() === '*') {
        this.advance(); // Skip */
        this.advance();
      }
    }
    return value;
  }

  nextToken() {
    this.skipWhitespace();
    
    if (!this.current()) {
      return { type: TokenType.EOF, value: null, line: this.line, column: this.column };
    }

    const char = this.current();
    const line = this.line;
    const column = this.column;

    // Comments
    if (char === '/' && (this.peek() === '/' || this.peek() === '*')) {
      const value = this.readComment();
      return { type: TokenType.COMMENT, value, line, column };
    }

    // Strings
    if (char === '"' || char === "'") {
      const value = this.readString();
      return { type: TokenType.STRING, value, line, column };
    }

    // Numbers
    if (/\d/.test(char)) {
      const value = this.readNumber();
      return { type: TokenType.NUMBER, value, line, column };
    }

    // Identifiers and Keywords
    if (/[a-zA-Z_]/.test(char)) {
      const value = this.readIdentifier();
      const type = KEYWORDS.has(value) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
      return { type, value, line, column };
    }

    // Operators and Punctuation
    if (/[{}();:,.]/.test(char)) {
      this.advance();
      return { type: TokenType.PUNCTUATION, value: char, line, column };
    }

    if (/[=<>!+\-*/]/.test(char)) {
      this.advance();
      return { type: TokenType.OPERATOR, value: char, line, column };
    }

    // Unknown character
    this.advance();
    return { type: TokenType.IDENTIFIER, value: char, line, column };
  }

  tokenize() {
    const tokens = [];
    let token;
    do {
      token = this.nextToken();
      if (token.type !== TokenType.WHITESPACE) {
        tokens.push(token);
      }
    } while (token.type !== TokenType.EOF);
    return tokens;
  }
}

// AST Node Types
class ASTNode {
  constructor(type, properties = {}) {
    this.type = type;
    this.properties = properties;
    this.children = [];
  }

  addChild(child) {
    this.children.push(child);
    return this;
  }
}

// SysML v2 Parser
class SysMLParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
    this.ast = new ASTNode('root');
  }

  current() {
    return this.position < this.tokens.length ? this.tokens[this.position] : null;
  }

  advance() {
    this.position++;
  }

  expect(type, value = null) {
    const token = this.current();
    if (!token || token.type !== type || (value && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''} but got ${token ? `${token.type} '${token.value}'` : 'EOF'}`);
    }
    this.advance();
    return token;
  }

  parseElement() {
    const token = this.current();
    if (!token || token.type === TokenType.EOF) return null;

    if (token.type === TokenType.KEYWORD) {
      switch (token.value) {
        case 'package':
          return this.parsePackage();
        case 'part':
          return this.parsePart();
        case 'attribute':
          return this.parseAttribute();
        case 'port':
          return this.parsePort();
        case 'connection':
          return this.parseConnection();
        case 'requirement':
          return this.parseRequirement();
        case 'use':
          return this.parseUseCase();
        default:
          return this.parseGenericElement();
      }
    }
    
    return this.parseGenericElement();
  }

  parsePackage() {
    const packageNode = new ASTNode('package');
    this.expect(TokenType.KEYWORD, 'package');
    
    if (this.current()?.type === TokenType.IDENTIFIER) {
      packageNode.properties.name = this.current().value;
      this.advance();
    }

    if (this.current()?.value === '{') {
      this.expect(TokenType.PUNCTUATION, '{');
      
      while (this.current() && this.current().value !== '}') {
        const element = this.parseElement();
        if (element) {
          packageNode.addChild(element);
        }
      }
      
      this.expect(TokenType.PUNCTUATION, '}');
    }

    return packageNode;
  }

  parsePart() {
    const partNode = new ASTNode('part');
    this.expect(TokenType.KEYWORD, 'part');
    
    if (this.current()?.type === TokenType.IDENTIFIER) {
      partNode.properties.name = this.current().value;
      this.advance();
    }

    // Handle specialization
    if (this.current()?.value === 'specializes') {
      this.advance();
      if (this.current()?.type === TokenType.IDENTIFIER) {
        partNode.properties.specializes = this.current().value;
        this.advance();
      }
    }

    if (this.current()?.value === '{') {
      this.expect(TokenType.PUNCTUATION, '{');
      
      while (this.current() && this.current().value !== '}') {
        const element = this.parseElement();
        if (element) {
          partNode.addChild(element);
        }
      }
      
      this.expect(TokenType.PUNCTUATION, '}');
    } else if (this.current()?.value === ';') {
      this.advance();
    }

    return partNode;
  }

  parseAttribute() {
    const attrNode = new ASTNode('attribute');
    this.expect(TokenType.KEYWORD, 'attribute');
    
    if (this.current()?.type === TokenType.IDENTIFIER) {
      attrNode.properties.name = this.current().value;
      this.advance();
    }

    if (this.current()?.value === ':') {
      this.advance();
      if (this.current()?.type === TokenType.IDENTIFIER) {
        attrNode.properties.type = this.current().value;
        this.advance();
      }
    }

    if (this.current()?.value === '=') {
      this.advance();
      if (this.current()?.type === TokenType.NUMBER || this.current()?.type === TokenType.STRING) {
        attrNode.properties.defaultValue = this.current().value;
        this.advance();
      }
    }

    if (this.current()?.value === ';') {
      this.advance();
    }

    return attrNode;
  }

  parsePort() {
    const portNode = new ASTNode('port');
    this.expect(TokenType.KEYWORD, 'port');
    
    if (this.current()?.type === TokenType.IDENTIFIER) {
      portNode.properties.name = this.current().value;
      this.advance();
    }

    if (this.current()?.value === ':') {
      this.advance();
      if (this.current()?.type === TokenType.IDENTIFIER) {
        portNode.properties.type = this.current().value;
        this.advance();
      }
    }

    if (this.current()?.value === ';') {
      this.advance();
    }

    return portNode;
  }

  parseConnection() {
    const connNode = new ASTNode('connection');
    this.expect(TokenType.KEYWORD, 'connection');
    
    if (this.current()?.type === TokenType.IDENTIFIER) {
      connNode.properties.name = this.current().value;
      this.advance();
    }

    if (this.current()?.value === ':') {
      this.advance();
      if (this.current()?.type === TokenType.IDENTIFIER) {
        connNode.properties.from = this.current().value;
        this.advance();
        
        if (this.current()?.type === TokenType.IDENTIFIER) {
          connNode.properties.to = this.current().value;
          this.advance();
        }
      }
    }

    if (this.current()?.value === ';') {
      this.advance();
    }

    return connNode;
  }

  parseRequirement() {
    const reqNode = new ASTNode('requirement');
    this.expect(TokenType.KEYWORD, 'requirement');
    
    if (this.current()?.type === TokenType.IDENTIFIER) {
      reqNode.properties.name = this.current().value;
      this.advance();
    }

    if (this.current()?.value === '{') {
      this.expect(TokenType.PUNCTUATION, '{');
      
      while (this.current() && this.current().value !== '}') {
        const element = this.parseElement();
        if (element) {
          reqNode.addChild(element);
        }
      }
      
      this.expect(TokenType.PUNCTUATION, '}');
    }

    return reqNode;
  }

  parseUseCase() {
    const useCaseNode = new ASTNode('usecase');
    this.expect(TokenType.KEYWORD, 'use');
    
    if (this.current()?.value === 'case') {
      this.advance();
    }
    
    if (this.current()?.type === TokenType.IDENTIFIER) {
      useCaseNode.properties.name = this.current().value;
      this.advance();
    }

    if (this.current()?.value === '{') {
      this.expect(TokenType.PUNCTUATION, '{');
      
      while (this.current() && this.current().value !== '}') {
        const element = this.parseElement();
        if (element) {
          useCaseNode.addChild(element);
        }
      }
      
      this.expect(TokenType.PUNCTUATION, '}');
    }

    return useCaseNode;
  }

  parseGenericElement() {
    if (!this.current()) return null;
    
    const node = new ASTNode('generic');
    
    if (this.current().type === TokenType.IDENTIFIER) {
      node.properties.name = this.current().value;
      this.advance();
    }

    // Skip tokens until we find a semicolon or closing brace
    while (this.current() && this.current().value !== ';' && this.current().value !== '}') {
      this.advance();
    }

    if (this.current()?.value === ';') {
      this.advance();
    }

    return node;
  }

  parse() {
    try {
      while (this.current() && this.current().type !== TokenType.EOF) {
        const element = this.parseElement();
        if (element) {
          this.ast.addChild(element);
        }
      }
      return this.ast;
    } catch (error) {
      console.error('Parse error:', error);
      return this.ast;
    }
  }
}

// Custom SVG Node Components
const NodeComponent = ({ node, x, y, onNodeClick, isSelected, children }) => {
  const getNodeStyle = (type) => {
    switch (type) {
      case 'package':
        return {
          fill: '#EBF8FF',
          stroke: '#3182CE',
          strokeWidth: 2,
          color: '#1A365D'
        };
      case 'part':
        return {
          fill: '#F0FFF4',
          stroke: '#38A169',
          strokeWidth: 2,
          color: '#1A202C'
        };
      case 'attribute':
        return {
          fill: '#FFFBEB',
          stroke: '#D69E2E',
          strokeWidth: 1,
          color: '#744210'
        };
      case 'port':
        return {
          fill: '#FAF5FF',
          stroke: '#805AD5',
          strokeWidth: 1,
          color: '#44337A'
        };
      case 'requirement':
        return {
          fill: '#FFF5F5',
          stroke: '#E53E3E',
          strokeWidth: 2,
          color: '#742A2A'
        };
      case 'usecase':
        return {
          fill: '#F7FAFC',
          stroke: '#4299E1',
          strokeWidth: 2,
          color: '#2D3748'
        };
      default:
        return {
          fill: '#F7FAFC',
          stroke: '#718096',
          strokeWidth: 1,
          color: '#2D3748'
        };
    }
  };

  const style = getNodeStyle(node.type);
  const width = Math.max(120, (node.properties.name || 'Unnamed').length * 8 + 40);
  const height = node.type === 'attribute' || node.type === 'port' ? 30 : 60;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={width}
        height={height}
        rx={node.type === 'attribute' || node.type === 'port' ? 4 : 8}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={isSelected ? style.strokeWidth + 1 : style.strokeWidth}
        className="cursor-pointer hover:opacity-80"
        onClick={() => onNodeClick(node)}
      />
      
      {/* Node type label */}
      {(node.type !== 'attribute' && node.type !== 'port') && (
        <text
          x={width / 2}
          y={16}
          textAnchor="middle"
          className="text-xs font-medium"
          fill={style.color}
          opacity={0.7}
        >
          «{node.type === 'usecase' ? 'use case' : node.type}»
        </text>
      )}
      
      {/* Node name */}
      <text
        x={width / 2}
        y={node.type === 'attribute' || node.type === 'port' ? 20 : 35}
        textAnchor="middle"
        className={`font-semibold ${node.type === 'attribute' || node.type === 'port' ? 'text-sm' : 'text-base'}`}
        fill={style.color}
      >
        {node.properties.name || 'Unnamed'}
      </text>
      
      {/* Additional info for attributes */}
      {node.type === 'attribute' && (node.properties.type || node.properties.defaultValue !== undefined) && (
        <text
          x={width / 2}
          y={45}
          textAnchor="middle"
          className="text-xs"
          fill={style.color}
          opacity={0.8}
        >
          {node.properties.type && `: ${node.properties.type}`}
          {node.properties.defaultValue !== undefined && ` = ${node.properties.defaultValue}`}
        </text>
      )}
      
      {/* Specialization info for parts */}
      {node.type === 'part' && node.properties.specializes && (
        <text
          x={width / 2}
          y={50}
          textAnchor="middle"
          className="text-xs"
          fill={style.color}
          opacity={0.7}
        >
          : {node.properties.specializes}
        </text>
      )}
      
      {children}
    </g>
  );
};

// AST to SVG converter
const astToSVG = (ast, onNodeClick, selectedNode) => {
  const elements = [];
  const connections = [];
  let nodeId = 0;

  const processNode = (astNode, parentPos = null, x = 50, y = 50, level = 0) => {
    const currentId = `node-${nodeId++}`;
    const width = Math.max(120, (astNode.properties.name || 'Unnamed').length * 8 + 40);
    const height = astNode.type === 'attribute' || astNode.type === 'port' ? 30 : 60;
    
    const nodePos = { x, y, width, height, id: currentId };

    // Create SVG element
    elements.push(
      <NodeComponent
        key={currentId}
        node={astNode}
        x={x}
        y={y}
        onNodeClick={onNodeClick}
        isSelected={selectedNode?.properties.name === astNode.properties.name}
      />
    );

    // Create connection to parent
    if (parentPos) {
      connections.push(
        <line
          key={`line-${parentPos.id}-${currentId}`}
          x1={parentPos.x + parentPos.width / 2}
          y1={parentPos.y + parentPos.height}
          x2={x + width / 2}
          y2={y}
          stroke="#718096"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
      );
    }

    // Process children
    let childY = y + height + 40;
    let childX = x;
    astNode.children.forEach((child, index) => {
      const childWidth = Math.max(120, (child.properties.name || 'Unnamed').length * 8 + 40);
      processNode(child, nodePos, childX, childY, level + 1);
      childX += childWidth + 30;
      if (index > 0 && index % 3 === 0) {
        childY += 100;
        childX = x;
      }
    });
  };

  // Process root children
  let rootX = 50;
  let rootY = 50;
  ast.children.forEach((child, index) => {
    const width = Math.max(120, (child.properties.name || 'Unnamed').length * 8 + 40);
    processNode(child, null, rootX, rootY, 0);
    rootX += width + 100;
    if (index > 0 && index % 2 === 0) {
      rootY += 300;
      rootX = 50;
    }
  });

  return { elements, connections };
};

// Main Component
const SysMLV2ParserVisualizer = () => {
  const [sysmlCode, setSysmlCode] = useState(`package ExampleSystem {
  part Vehicle {
    attribute mass : Real = 1500.0;
    attribute speed : Real;
    port fuelPort : FuelInterface;
    port powerPort : PowerInterface;
    
    part Engine specializes PowerUnit {
      attribute power : Real = 150.0;
      port fuelInput : FuelInterface;
    }
    
    part FuelTank {
      attribute capacity : Real = 50.0;
      port fuelOutput : FuelInterface;
    }
    
    connection fuelConnection : fuelPort FuelTank.fuelOutput;
  }
  
  requirement SafetyRequirement {
    attribute maxSpeed : Real = 200.0;
  }
  
  use case DriveVehicle {
    attribute description : String = "User drives the vehicle";
  }
}`);

  const [parseError, setParseError] = useState(null);
  const [ast, setAst] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1000, height: 600 });
  const [scale, setScale] = useState(1);

  const parseSysML = useCallback(() => {
    try {
      setParseError(null);
      
      // Tokenize
      const tokenizer = new SysMLTokenizer(sysmlCode);
      const tokens = tokenizer.tokenize();
      
      // Parse
      const parser = new SysMLParser(tokens);
      const parsedAst = parser.parse();
      
      setAst(parsedAst);
    } catch (error) {
      setParseError(error.message);
      console.error('Parsing error:', error);
    }
  }, [sysmlCode]);

  // Auto-parse when code changes
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      parseSysML();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [parseSysML]);

  const handleNodeClick = (node) => {
    setSelectedNode(selectedNode === node ? null : node);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.3));
  };

  const handleReset = () => {
    setScale(1);
    setViewBox({ x: 0, y: 0, width: 1000, height: 600 });
  };

  const { elements, connections } = useMemo(() => {
    if (!ast) return { elements: [], connections: [] };
    return astToSVG(ast, handleNodeClick, selectedNode);
  }, [ast, selectedNode]);

  const totalNodes = ast ? ast.children.reduce((count, child) => {
    const countChildren = (node) => {
      return 1 + node.children.reduce((sum, child) => sum + countChildren(child), 0);
    };
    return count + countChildren(child);
  }, 0) : 0;

  return (
    <div className="w-full h-screen flex bg-gray-50">
      {/* Code Editor */}
      <div className="w-1/2 border-r border-gray-300 flex flex-col bg-white">
        <div className="p-4 bg-gray-100 border-b">
          <h2 className="text-lg font-semibold mb-2">SysML v2 Code Editor</h2>
          {parseError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
              Parse Error: {parseError}
            </div>
          )}
        </div>
        
        <textarea
          value={sysmlCode}
          onChange={(e) => setSysmlCode(e.target.value)}
          className="flex-1 p-4 font-mono text-sm resize-none border-none outline-none"
          placeholder="Enter your SysML v2 code here..."
        />
        
        <div className="p-4 bg-gray-50 border-t text-sm text-gray-600">
          <div className="mb-2">
            <strong>Supported Elements:</strong> package, part, attribute, port, connection, requirement, use case
          </div>
          <div>
            <strong>Example Syntax:</strong> part MyPart &#123; attribute name : String; &#125;
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div className="w-1/2 relative flex flex-col">
        {/* Controls */}
        <div className="absolute top-4 left-4 z-10 bg-white p-3 rounded-lg shadow-lg border">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-sm">SysML v2 Visualizer</h3>
            <span className="text-xs text-gray-500">({totalNodes} elements)</span>
          </div>
          
          <div className="flex gap-1">
            <button
              onClick={handleZoomIn}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Zoom +
            </button>
            <button
              onClick={handleZoomOut}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Zoom -
            </button>
            <button
              onClick={handleReset}
              className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Node Details Panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-10 bg-white p-3 rounded-lg shadow-lg border max-w-xs">
            <h4 className="font-semibold text-sm mb-2">
              {selectedNode.properties.name || 'Unnamed'} 
              <span className="text-gray-500 ml-2">({selectedNode.type})</span>
            </h4>
            
            {Object.entries(selectedNode.properties).map(([key, value]) => (
              value !== undefined && key !== 'name' && (
                <div key={key} className="text-xs mb-1">
                  <span className="font-medium">{key}:</span> {value.toString()}
                </div>
              )
            ))}
            
            {selectedNode.children.length > 0 && (
              <div className="text-xs mt-2">
                <span className="font-medium">Children:</span> {selectedNode.children.length}
              </div>
            )}
            
            <button
              onClick={() => setSelectedNode(null)}
              className="mt-2 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        )}

        {/* SVG Visualization */}
        <div className="flex-1 overflow-auto">
          <svg
            width="100%"
            height="100%"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width / scale} ${viewBox.height / scale}`}
            className="bg-white"
          >
            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#718096"
                />
              </marker>
            </defs>
            
            {/* Render connections first (behind nodes) */}
            {connections}
            
            {/* Render nodes */}
            {elements}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default SysMLV2ParserVisualizer;
