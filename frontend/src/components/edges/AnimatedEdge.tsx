import { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import { Lock } from 'lucide-react';

interface AnimatedEdgeData {
  animated?: boolean;
  secure?: boolean;
  label?: string;
}

const AnimatedEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}: EdgeProps) => {
  const edgeData = data as AnimatedEdgeData;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={style}
        className={`
          fill-none stroke-2 transition-all duration-300
          ${edgeData?.animated ? 'animate-dash' : ''}
          ${edgeData?.secure ? 'stroke-accent' : 'stroke-primary'}
        `}
        strokeDasharray={edgeData?.secure ? "5,5" : edgeData?.animated ? "8,4" : "none"}
        d={edgePath}
        markerEnd="url(#arrow)"
      />
      
      {edgeData?.secure && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-accent/20 backdrop-blur-sm border border-accent/40 rounded-full p-1.5"
          >
            <Lock className="w-3 h-3 text-accent" />
          </div>
        </EdgeLabelRenderer>
      )}

      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 20}px)`,
              pointerEvents: 'all',
            }}
            className="glass-panel text-xs px-2 py-1 rounded-md"
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(AnimatedEdge);
