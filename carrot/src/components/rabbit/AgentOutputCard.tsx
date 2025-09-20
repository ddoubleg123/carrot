import React, { useState } from 'react';
import { tokens } from '@/styles/tokens';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Download, 
  ExternalLink,
  User,
  Calendar,
  Zap
} from 'lucide-react';

export interface AuditResult {
  id: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  title: string;
  description: string;
  details?: string;
  code?: string;
  suggestions?: string[];
  timestamp: Date;
  duration?: number; // in milliseconds
}

export interface AgentOutputCardProps {
  agentName: string;
  agentAvatar: string;
  taskTitle: string;
  results: AuditResult[];
  timestamp: Date;
  duration: number;
  onCopy?: (content: string) => void;
  onDownload?: () => void;
  onShare?: () => void;
}

const StatusIcon: React.FC<{ status: AuditResult['status'] }> = ({ status }) => {
  const iconStyle = {
    width: '1.25rem',
    height: '1.25rem',
  };

  switch (status) {
    case 'success':
      return <CheckCircle style={{ ...iconStyle, color: tokens.colors.success[600] }} />;
    case 'error':
      return <XCircle style={{ ...iconStyle, color: tokens.colors.error[600] }} />;
    case 'warning':
      return <AlertTriangle style={{ ...iconStyle, color: tokens.colors.warning[600] }} />;
    case 'pending':
      return <Clock style={{ ...iconStyle, color: tokens.colors.gray[500] }} />;
    default:
      return null;
  }
};

const ResultItem: React.FC<{ result: AuditResult; onCopy?: (content: string) => void }> = ({ 
  result, 
  onCopy 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const containerStyle = {
    backgroundColor: tokens.colors.white,
    border: `1px solid ${tokens.colors.gray[200]}`,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.padding.md,
    marginBottom: tokens.spacing[3],
    transition: `all ${tokens.animation.duration[200]} ${tokens.animation.easing.inOut}`,
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacing.gap.sm,
    cursor: result.details || result.code || result.suggestions ? 'pointer' : 'default',
  };

  const contentStyle = {
    flex: 1,
  };

  const titleStyle = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.gray[900],
    marginBottom: tokens.spacing[1],
  };

  const descriptionStyle = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.gray[600],
    lineHeight: tokens.typography.lineHeight.relaxed,
  };

  const expandButtonStyle = {
    padding: tokens.spacing[1],
    borderRadius: tokens.borderRadius.md,
    border: 'none',
    backgroundColor: tokens.colors.transparent,
    color: tokens.colors.gray[500],
    cursor: 'pointer',
    transition: `all ${tokens.animation.duration[150]} ${tokens.animation.easing.inOut}`,
  };

  const expandedContentStyle = {
    marginTop: tokens.spacing[4],
    paddingTop: tokens.spacing[4],
    borderTop: `1px solid ${tokens.colors.gray[200]}`,
  };

  const codeBlockStyle = {
    backgroundColor: tokens.colors.gray[50],
    border: `1px solid ${tokens.colors.gray[200]}`,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing[3],
    fontFamily: tokens.typography.fontFamily.mono,
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.gray[800],
    overflow: 'auto',
    position: 'relative' as const,
    marginBottom: tokens.spacing[3],
  };

  const copyButtonStyle = {
    position: 'absolute' as const,
    top: tokens.spacing[2],
    right: tokens.spacing[2],
    padding: tokens.spacing[1],
    backgroundColor: tokens.colors.white,
    border: `1px solid ${tokens.colors.gray[300]}`,
    borderRadius: tokens.borderRadius.sm,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[1],
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.gray[600],
    transition: `all ${tokens.animation.duration[150]} ${tokens.animation.easing.inOut}`,
  };

  const hasExpandableContent = result.details || result.code || result.suggestions;

  return (
    <div style={containerStyle}>
      <div 
        style={headerStyle}
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
      >
        <StatusIcon status={result.status} />
        <div style={contentStyle}>
          <div style={titleStyle}>{result.title}</div>
          <div style={descriptionStyle}>{result.description}</div>
        </div>
        {hasExpandableContent && (
          <button
            style={expandButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.gray[100];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.transparent;
            }}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {isExpanded && hasExpandableContent && (
        <div style={expandedContentStyle}>
          {result.details && (
            <div style={{ marginBottom: tokens.spacing[3] }}>
              <h4 style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.gray[900],
                marginBottom: tokens.spacing[2],
              }}>
                Details
              </h4>
              <p style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.gray[700],
                lineHeight: tokens.typography.lineHeight.relaxed,
              }}>
                {result.details}
              </p>
            </div>
          )}

          {result.code && (
            <div style={{ marginBottom: tokens.spacing[3] }}>
              <h4 style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.gray[900],
                marginBottom: tokens.spacing[2],
              }}>
                Code
              </h4>
              <div style={codeBlockStyle}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {result.code}
                </pre>
                {onCopy && (
                  <button
                    style={copyButtonStyle}
                    onClick={() => onCopy(result.code!)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = tokens.colors.gray[50];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = tokens.colors.white;
                    }}
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                )}
              </div>
            </div>
          )}

          {result.suggestions && result.suggestions.length > 0 && (
            <div>
              <h4 style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.gray[900],
                marginBottom: tokens.spacing[2],
              }}>
                Suggestions
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {result.suggestions.map((suggestion, index) => (
                  <li key={index} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: tokens.spacing[2],
                    padding: tokens.spacing[2],
                    backgroundColor: tokens.colors.gray[50],
                    borderRadius: tokens.borderRadius.md,
                    marginBottom: tokens.spacing[2],
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.gray[700],
                  }}>
                    <Zap size={16} style={{ color: tokens.colors.primary[500], flexShrink: 0, marginTop: '2px' }} />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AgentOutputCard: React.FC<AgentOutputCardProps> = ({
  agentName,
  agentAvatar,
  taskTitle,
  results,
  timestamp,
  duration,
  onCopy,
  onDownload,
  onShare,
}) => {
  const cardStyle = {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.borderRadius.xl,
    boxShadow: tokens.shadows.lg,
    border: `1px solid ${tokens.colors.gray[200]}`,
    overflow: 'hidden',
    marginBottom: tokens.spacing[6],
  };

  const headerStyle = {
    padding: tokens.spacing.padding.lg,
    borderBottom: `1px solid ${tokens.colors.gray[200]}`,
    backgroundColor: tokens.colors.gray[50],
  };

  const headerTopStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing[3],
  };

  const agentInfoStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing.gap.sm,
  };

  const avatarStyle = {
    width: tokens.components.avatar.size.md,
    height: tokens.components.avatar.size.md,
    borderRadius: tokens.components.avatar.radius,
    objectFit: 'cover' as const,
  };

  const agentNameStyle = {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.gray[900],
  };

  const actionsStyle = {
    display: 'flex',
    gap: tokens.spacing.gap.sm,
  };

  const actionButtonStyle = {
    padding: tokens.spacing[2],
    backgroundColor: tokens.colors.white,
    border: `1px solid ${tokens.colors.gray[300]}`,
    borderRadius: tokens.borderRadius.md,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[1],
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.gray[600],
    transition: `all ${tokens.animation.duration[150]} ${tokens.animation.easing.inOut}`,
  };

  const taskTitleStyle = {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.gray[900],
    marginBottom: tokens.spacing[2],
  };

  const metaInfoStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[4],
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.gray[600],
  };

  const metaItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[1],
  };

  const contentStyle = {
    padding: tokens.spacing.padding.lg,
  };

  const summaryStyle = {
    display: 'flex',
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[6],
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.gray[50],
    borderRadius: tokens.borderRadius.lg,
    border: `1px solid ${tokens.colors.gray[200]}`,
  };

  const summaryItemStyle = {
    textAlign: 'center' as const,
    flex: 1,
  };

  const summaryCountStyle = {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing[1],
  };

  const summaryLabelStyle = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.gray[600],
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  // Calculate summary stats
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerTopStyle}>
          <div style={agentInfoStyle}>
            <img src={agentAvatar} alt={agentName} style={avatarStyle} />
            <div style={agentNameStyle}>{agentName}</div>
          </div>
          <div style={actionsStyle}>
            {onCopy && (
              <button
                style={actionButtonStyle}
                onClick={() => onCopy(JSON.stringify(results, null, 2))}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.gray[50];
                  e.currentTarget.style.borderColor = tokens.colors.gray[400];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.white;
                  e.currentTarget.style.borderColor = tokens.colors.gray[300];
                }}
              >
                <Copy size={16} />
                Copy
              </button>
            )}
            {onDownload && (
              <button
                style={actionButtonStyle}
                onClick={onDownload}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.gray[50];
                  e.currentTarget.style.borderColor = tokens.colors.gray[400];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.white;
                  e.currentTarget.style.borderColor = tokens.colors.gray[300];
                }}
              >
                <Download size={16} />
                Export
              </button>
            )}
            {onShare && (
              <button
                style={actionButtonStyle}
                onClick={onShare}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.gray[50];
                  e.currentTarget.style.borderColor = tokens.colors.gray[400];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.colors.white;
                  e.currentTarget.style.borderColor = tokens.colors.gray[300];
                }}
              >
                <ExternalLink size={16} />
                Share
              </button>
            )}
          </div>
        </div>
        
        <div style={taskTitleStyle}>{taskTitle}</div>
        
        <div style={metaInfoStyle}>
          <div style={metaItemStyle}>
            <Calendar size={16} />
            {formatTimestamp(timestamp)}
          </div>
          <div style={metaItemStyle}>
            <Clock size={16} />
            {formatDuration(duration)}
          </div>
          <div style={metaItemStyle}>
            <User size={16} />
            {results.length} results
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {/* Summary */}
        <div style={summaryStyle}>
          <div style={summaryItemStyle}>
            <div style={{ ...summaryCountStyle, color: tokens.colors.success[600] }}>
              {successCount}
            </div>
            <div style={summaryLabelStyle}>Success</div>
          </div>
          <div style={summaryItemStyle}>
            <div style={{ ...summaryCountStyle, color: tokens.colors.error[600] }}>
              {errorCount}
            </div>
            <div style={summaryLabelStyle}>Errors</div>
          </div>
          <div style={summaryItemStyle}>
            <div style={{ ...summaryCountStyle, color: tokens.colors.warning[600] }}>
              {warningCount}
            </div>
            <div style={summaryLabelStyle}>Warnings</div>
          </div>
          <div style={summaryItemStyle}>
            <div style={{ ...summaryCountStyle, color: tokens.colors.gray[500] }}>
              {pendingCount}
            </div>
            <div style={summaryLabelStyle}>Pending</div>
          </div>
        </div>

        {/* Results */}
        <div>
          {results.map((result) => (
            <ResultItem
              key={result.id}
              result={result}
              onCopy={onCopy}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
