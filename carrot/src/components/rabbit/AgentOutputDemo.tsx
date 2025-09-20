import React from 'react';
import { AgentOutputCard, AuditResult } from './AgentOutputCard';

export const AgentOutputDemo: React.FC = () => {
  const sampleResults: AuditResult[] = [
    {
      id: '1',
      status: 'success',
      title: 'Code Quality Check Passed',
      description: 'All TypeScript files follow proper coding standards and best practices.',
      details: 'Analyzed 47 TypeScript files across the project. Found consistent use of interfaces, proper error handling, and adherence to naming conventions.',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      duration: 2400,
    },
    {
      id: '2',
      status: 'warning',
      title: 'Performance Optimization Opportunities',
      description: 'Found several areas where performance could be improved.',
      details: 'Identified unused imports, large bundle sizes, and inefficient re-renders in React components.',
      code: `// Example: Optimize this component
const MyComponent = () => {
  const [data, setData] = useState([]);
  
  // This effect runs on every render
  useEffect(() => {
    fetchData().then(setData);
  }); // Missing dependency array
  
  return <div>{data.map(item => <Item key={item.id} {...item} />)}</div>;
};`,
      suggestions: [
        'Add dependency arrays to useEffect hooks to prevent unnecessary re-renders',
        'Use React.memo for components that receive stable props',
        'Consider code splitting for large components',
        'Remove unused imports to reduce bundle size'
      ],
      timestamp: new Date(Date.now() - 240000), // 4 minutes ago
      duration: 3200,
    },
    {
      id: '3',
      status: 'error',
      title: 'Security Vulnerability Detected',
      description: 'Found potential XSS vulnerability in user input handling.',
      details: 'The application directly renders user input without proper sanitization, which could lead to cross-site scripting attacks.',
      code: `// Vulnerable code found in UserProfile.tsx
const UserProfile = ({ userBio }: { userBio: string }) => {
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: userBio }} 
    />
  );
};`,
      suggestions: [
        'Use a sanitization library like DOMPurify before rendering HTML',
        'Consider using markdown parsing instead of raw HTML',
        'Implement Content Security Policy (CSP) headers',
        'Validate and escape all user inputs on the server side'
      ],
      timestamp: new Date(Date.now() - 180000), // 3 minutes ago
      duration: 1800,
    },
    {
      id: '4',
      status: 'success',
      title: 'Accessibility Audit Passed',
      description: 'All components meet WCAG 2.1 AA accessibility standards.',
      details: 'Checked for proper ARIA labels, keyboard navigation, color contrast ratios, and semantic HTML structure.',
      timestamp: new Date(Date.now() - 120000), // 2 minutes ago
      duration: 4100,
    },
    {
      id: '5',
      status: 'pending',
      title: 'Database Schema Analysis',
      description: 'Currently analyzing database schema for optimization opportunities...',
      timestamp: new Date(Date.now() - 60000), // 1 minute ago
    },
  ];

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    // In a real app, you'd show a toast notification here
    console.log('Copied to clipboard:', content.substring(0, 50) + '...');
  };

  const handleDownload = () => {
    const dataStr = JSON.stringify(sampleResults, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `audit-results-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleShare = () => {
    // In a real app, this would open a share dialog or generate a shareable link
    console.log('Share functionality would be implemented here');
  };

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          marginBottom: '2rem',
          color: '#1f2937'
        }}>
          Agent Output Card Demo
        </h1>
        
        <AgentOutputCard
          agentName="Security Auditor"
          agentAvatar="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
          taskTitle="Complete Security & Performance Audit"
          results={sampleResults}
          timestamp={new Date(Date.now() - 300000)}
          duration={12500}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onShare={handleShare}
        />
        
        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          backgroundColor: 'white', 
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
            Features Demonstrated:
          </h2>
          <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', color: '#6b7280' }}>
            <li>Status indicators with color coding (success, warning, error, pending)</li>
            <li>Expandable result items with detailed information</li>
            <li>Code syntax highlighting and copy functionality</li>
            <li>Actionable suggestions with clear formatting</li>
            <li>Summary statistics with visual counts</li>
            <li>Agent information and task metadata</li>
            <li>Export and sharing capabilities</li>
            <li>Responsive design using design tokens</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
