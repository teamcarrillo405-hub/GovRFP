'use client'
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

interface OrbProps {
  nodeCount: number
  winRate: number // 0-100
}

function PipelineOrb({ nodeCount, winRate }: OrbProps) {
  const outerRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const ringRef   = useRef<THREE.Mesh>(null)
  const ring2Ref  = useRef<THREE.Mesh>(null)

  const outerGeo = useMemo(() => new THREE.IcosahedronGeometry(2.1, 2), [])
  const innerGeo = useMemo(() => new THREE.IcosahedronGeometry(1.25, 1), [])

  // Ring arc = win rate / 100 of full circle
  const ringAngle = useMemo(() => (winRate / 100) * Math.PI * 2, [winRate])
  const ringGeo   = useMemo(
    () => new THREE.TorusGeometry(2.6, 0.006, 4, 80, ringAngle),
    [ringAngle]
  )
  const ring2Geo  = useMemo(() => new THREE.TorusGeometry(3.1, 0.003, 4, 80), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (outerRef.current)  { outerRef.current.rotation.y  =  t * 0.07; outerRef.current.rotation.x  =  t * 0.025 }
    if (innerRef.current)  { innerRef.current.rotation.y  = -t * 0.11; innerRef.current.rotation.x  =  t * 0.045 }
    if (pointsRef.current) { pointsRef.current.rotation.y =  t * 0.07; pointsRef.current.rotation.x =  t * 0.025 }
    if (ringRef.current)   { ringRef.current.rotation.z   =  t * 0.04; ringRef.current.rotation.x   = 0.4 }
    if (ring2Ref.current)  { ring2Ref.current.rotation.z  = -t * 0.02; ring2Ref.current.rotation.x  = -0.3 }
  })

  return (
    <>
      {/* Outer icosahedron — gold wireframe */}
      <mesh ref={outerRef} geometry={outerGeo}>
        <meshBasicMaterial color="#D4AF37" wireframe transparent opacity={0.14} />
      </mesh>

      {/* Inner icosahedron — brighter gold, counter-rotates */}
      <mesh ref={innerRef} geometry={innerGeo}>
        <meshBasicMaterial color="#D4AF37" wireframe transparent opacity={0.32} />
      </mesh>

      {/* Vertex glow points — node count drives density */}
      <points ref={pointsRef} geometry={outerGeo}>
        <pointsMaterial
          color="#FFD700"
          size={Math.min(0.08, 0.03 + nodeCount * 0.003)}
          transparent
          opacity={0.95}
          sizeAttenuation
        />
      </points>

      {/* Win-rate orbital arc ring */}
      <mesh ref={ringRef} geometry={ringGeo}>
        <meshBasicMaterial color="#D4AF37" transparent opacity={0.55} />
      </mesh>

      {/* Outer faint equatorial ring */}
      <mesh ref={ring2Ref} geometry={ring2Geo}>
        <meshBasicMaterial color="#D4AF37" transparent opacity={0.12} />
      </mesh>
    </>
  )
}

interface HolographicVizProps {
  style?: React.CSSProperties
  className?: string
  nodeCount?: number
  winRate?: number
}

export function HolographicViz({ style, className, nodeCount = 0, winRate = 0 }: HolographicVizProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', ...style }}>
      <Canvas
        camera={{ position: [0, 0, 5.8], fov: 40 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 1.5]}
      >
        <PipelineOrb nodeCount={nodeCount} winRate={winRate} />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.05}
            luminanceSmoothing={0.88}
            intensity={2.6}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
