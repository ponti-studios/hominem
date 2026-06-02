import { memo, useEffect, useMemo, useState } from 'react'
import styles from './AIProcessingAnimation.module.css'

const dataElements = [
  'experience',
  'skills',
  'education',
  'projects',
  'achievements',
  'certifications',
  'technologies',
  'languages',
  'frameworks',
  'databases',
  'tools',
  'methodologies',
  'leadership',
  'collaboration',
  'communication',
  'problem-solving',
  'analytics',
  'design',
  'development',
  'testing',
  'deployment',
  'optimization',
  'innovation',
]

interface DataColumn {
  id: number
  words: string
  speed: number
  offset: number
  isReverse: boolean
}

const MatrixColumn = memo(({ column }: { column: DataColumn }) => (
  <div
    className={`${styles.matrixColumn} ${column.isReverse ? styles.matrixColumnReverse : styles.matrixColumnNormal}`}
    style={
      {
        left: `${column.id * 12.5}%`,
        '--speed': `${column.speed}s`,
        '--delay': `${column.offset}s`,
      } as React.CSSProperties
    }
  >
    {column.words}
  </div>
))

MatrixColumn.displayName = 'MatrixColumn'

export const AIProcessingAnimation = memo(() => {
  const [columns, setColumns] = useState<DataColumn[]>([])

  const generateColumns = useMemo(
    () => () => {
      const newColumns: DataColumn[] = []
      for (let i = 0; i < 6; i++) {
        const words = Array.from(
          { length: 10 },
          () => dataElements[Math.floor(Math.random() * dataElements.length)]
        ).join('\n')

        newColumns.push({
          id: i,
          words,
          speed: 4 + Math.random() * 3,
          offset: Math.random() * 2,
          isReverse: i % 2 === 1,
        })
      }
      setColumns(newColumns)
    },
    []
  )

  useEffect(() => {
    generateColumns()
    const interval = setInterval(generateColumns, 6000)
    return () => clearInterval(interval)
  }, [generateColumns])

  return (
    <div className={styles.container}>
      {/* Animated gradient overlay */}
      <div className={styles.gradientOverlay} />

      {/* Matrix columns */}
      <div className={styles.matrixContainer}>
        {columns.map((column) => (
          <MatrixColumn key={`${column.id}-${column.words.slice(0, 20)}`} column={column} />
        ))}
      </div>

      {/* Center processing indicator */}
      <div className={styles.processingIndicator}>
        <div className="relative">
          <div className={styles.spinningRing} />
          <div className={styles.innerRing}>
            <div className={styles.aiText}>AI</div>
          </div>
        </div>
      </div>

      {/* Scanning line effect */}
      <div className={styles.scanLine} />

      {/* Status text */}
      <div className={styles.statusText}>
        <div className={styles.statusTitle}>Analyzing Resume Data...</div>
        <div className={styles.statusSubtitle}>Extracting • Structuring • Optimizing</div>
      </div>
    </div>
  )
})

AIProcessingAnimation.displayName = 'AIProcessingAnimation'
