'use client';

import * as React from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface StateSpaceChartProps {
  trajectory?: [number, number, number, number][]; // [potential, momentum, entropy, temperature]
  isLoading: boolean;
}

class ResizableCanvas {
  public readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;

  constructor(
    private readonly container: HTMLElement,
    private readonly scene: THREE.Scene
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      50,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(100, 100, 100);
    this.scene.add(this.camera);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = () => {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  };

  public dispose = () => {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  };
}

export function StateSpaceChart({ trajectory, isLoading }: StateSpaceChartProps) {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!mountRef.current || !trajectory || trajectory.length === 0) return;

    const scene = new THREE.Scene();

    const canvas = new ResizableCanvas(mountRef.current, scene);
    const camera = scene.children.find(c => c instanceof THREE.PerspectiveCamera) as THREE.PerspectiveCamera;
    
    const controls = new OrbitControls(camera, canvas.renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 10;
    controls.maxDistance = 500;

    // Axes Helper
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    // Grid Helper
    const gridHelper = new THREE.GridHelper(200, 20);
    gridHelper.position.y = -50;
    scene.add(gridHelper);

    // Plot trajectory
    const points = [];
    const colors = [];
    const color = new THREE.Color();
    const minTemp = Math.min(...trajectory.map(t => t[3]));
    const maxTemp = Math.max(...trajectory.map(t => t[3]));

    for (const point of trajectory) {
      points.push(new THREE.Vector3(point[0] - 50, point[1] - 50, point[2] - 50));
      const normalizedTemp = maxTemp > minTemp ? (point[3] - minTemp) / (maxTemp - minTemp) : 0.5;
      color.setHSL(0.7 - normalizedTemp * 0.7, 1.0, 0.5); // Blue to Red
      colors.push(color.r, color.g, color.b);
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({ size: 2, vertexColors: true });
    const pointCloud = new THREE.Points(geometry, material);
    scene.add(pointCloud);
    
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 });
    const line = new THREE.Line(geometry, lineMaterial);
    scene.add(line);


    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      canvas.renderer.render(scene, camera);
    };

    animate();

    return () => {
      canvas.dispose();
      controls.dispose();
      while(mountRef.current && mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
    };
  }, [trajectory]);

  return (
    <div className="h-full w-full flex flex-col">
       <div className="px-2">
            <CardTitle>4D State-Space Trajectory</CardTitle>
            <CardDescription>Potential (x), Momentum (y), Entropy (z), Temperature (color)</CardDescription>
        </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-full w-full" />
        </div>
      ) : (
        <div ref={mountRef} className="flex-1 min-h-0 w-full"></div>
      )}
    </div>
  );
}
