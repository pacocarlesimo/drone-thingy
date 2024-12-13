import { Component, OnInit } from '@angular/core';
import * as turf from '@turf/turf';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {GeoJSON} from 'geojson';

@Component({
  selector: 'app-drone-trajectory',
  templateUrl: './drone-trajectory.component.html',
  imports: [FormsModule, CommonModule],
  styleUrls: ['./drone-trajectory.component.css']
})
export class DroneTrajectoryComponent implements OnInit {
  canvasWidth: number = 1200;
  canvasHeight: number = 800;

  minLat: number = 41.7;
  maxLat: number = 42.1;
  minLon: number = 12.3;
  maxLon: number = 12.7;


  startPoint: { lat: number; lon: number; height: number } | null = null;
  endPoint: { lat: number; lon: number; height: number } | null = null;
  waypoints: { lat: number; lon: number; height: number }[] = [];
  dronePosition: { lat: number; lon: number; height: number } | null = null;
  startHeight: number = 5;
  endHeight: number = 3;

  currentCircleLogs: string[] = [];
  combinedBufferLogs: string[] = [];


  zoomLevel: number = 1.0;
  dronePathCoordinates: [number, number][] = [];

  ngOnInit(): void {}

  onMapClick(event: MouseEvent): void {
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;


    const { lat, lon } = this.canvasToLatLon(x, y);

    if (!this.startPoint) {
      this.startPoint = { lat, lon, height: this.startHeight };
      this.drawPoints();
    } else if (!this.endPoint) {
      this.endPoint = { lat, lon, height: this.endHeight };
      this.drawPoints();
    } else {
      const height = prompt('Inserisci l\'altezza (km) per questo punto:', '1');
      if (height !== null) {
        this.waypoints.push({ lat, lon, height: parseFloat(height) });
        this.drawPoints();
      }
    }
  }

  simulateDroneMovement(): void {
    if (!this.startPoint || !this.endPoint) {
      alert('Seleziona prima i punti di partenza e arrivo cliccando sulla mappa.');
      return;
    }

    const path = [this.startPoint, ...this.waypoints, this.endPoint];
    const totalSteps = 300;
    const stepsPerSegment = Math.floor(totalSteps / (path.length - 1));

    let step = 0;
    let currentSegment = 0;

    let combinedBuffer: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> = {
      type: 'FeatureCollection',
      features: [],
    };

    this.dronePathCoordinates = [];

    const interval = setInterval(() => {
      if (currentSegment >= path.length - 1) {
        clearInterval(interval);
        this.dronePosition = { ...path[path.length - 1] };
        this.dronePathCoordinates.push([this.dronePosition.lon, this.dronePosition.lat]);

        this.drawPoints();
        this.drawDrone();

        this.drawCombinedCircleBuffer(combinedBuffer);

        console.log('Buffer combinato finale (GeoJSON):', JSON.stringify(combinedBuffer, null, 2));

        return;
      }

      const start = path[currentSegment];
      const end = path[currentSegment + 1];

      const dLat = (end.lat - start.lat) / stepsPerSegment;
      const dLon = (end.lon - start.lon) / stepsPerSegment;
      const dHeight = (end.height - start.height) / stepsPerSegment;

      const lat = start.lat + dLat * (step % stepsPerSegment);
      const lon = start.lon + dLon * (step % stepsPerSegment);
      const height = start.height + dHeight * (step % stepsPerSegment);

      this.dronePosition = { lat, lon, height };
      this.dronePathCoordinates.push([lon, lat]);

      this.updateDronePathBuffer();

      const currentBuffer = this.createCircleBuffer(lat, lon, height);

      if (currentBuffer) {
        try {
          combinedBuffer.features.push(currentBuffer);
          this.logCurrentCircleBuffer(currentBuffer, [lon, lat], height);

          this.drawCombinedCircleBuffer(combinedBuffer);
          this.logCombinedBufferStep(combinedBuffer);

          //const bufferOutput = this.generateCombinedBufferOutput(combinedBuffer);
         // console.log('Buffer Combinato (JSON):', JSON.stringify(bufferOutput, null, 2));
        } catch (error) {
          console.error('Errore durante la combinazione dei buffer:', error);
        }
      }

      step++;
      if (step % stepsPerSegment === 0) {
        currentSegment++;
      }
    }, 100);
  }

  generateCombinedBufferOutput(buffer: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>): number[][] {
    const output: number[][] = [];

    buffer.features.forEach((feature) => {
      if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates.forEach((ring) => {
          ring.forEach((coordinate) => {
            output.push([coordinate[0], coordinate[1], 0]);
          });
        });
      } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach((polygon) => {
          polygon.forEach((ring) => {
            ring.forEach((coordinate) => {
              output.push([coordinate[0], coordinate[1], 0]);
            });
          });
        });
      }
    });

    return output;
  }

  zoomIn(): void {
    if (!this.dronePosition) {
      alert('Posizione del drone non presente per centrare lo zoom!');
      return;
    }

    this.zoomLevel = Math.min(this.zoomLevel * 1.2, 10);
    this.updateViewport(this.dronePosition.lat, this.dronePosition.lon);
    this.redrawMap();
  }

  zoomOut(): void {
    if (!this.dronePosition) {
      alert('Posizione del drone non presente per centrare lo zoom!');
      return;
    }

    this.zoomLevel = Math.max(this.zoomLevel / 1.2, 1);
    this.updateViewport(this.dronePosition.lat, this.dronePosition.lon);
    this.redrawMap();
  }

  updateViewport(centerLat: number, centerLon: number): void {
    const baseLatRange = 1.0;
    const baseLonRange = 1.0;

    const latRange = baseLatRange / this.zoomLevel;
    const lonRange = baseLonRange / this.zoomLevel;

    this.minLat = centerLat - latRange / 2;
    this.maxLat = centerLat + latRange / 2;
    this.minLon = centerLon - lonRange / 2;
    this.maxLon = centerLon + lonRange / 2;
  }

  redrawMap(): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.drawPoints();
    if (this.dronePosition) {
      this.drawDrone();
    }
  }

  updateDronePathBuffer(): void {
    if (this.dronePathCoordinates.length < 2) {
      return;
    }

    const line = turf.lineString(this.dronePathCoordinates);

    const featureCollection = turf.featureCollection([line]);

    const bufferOptions: { units: 'kilometers' } = { units: 'kilometers' };

    const bufferedFeatureCollection = turf.buffer(featureCollection, 0.1, bufferOptions as any);

    if (bufferedFeatureCollection && bufferedFeatureCollection.features.length > 0) {
      const bufferedPolygon = bufferedFeatureCollection.features[0] as GeoJSON.Feature<GeoJSON.Polygon>;
      this.drawDronePathBuffer(bufferedPolygon);
    } else {
      console.error('Buffering failed or returned an empty FeatureCollection.');
    }
  }

  drawDronePathBuffer(bufferedLine: GeoJSON.Feature<GeoJSON.Polygon>): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.redrawMap();
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';

    bufferedLine.geometry.coordinates.forEach((ring: any) => {
      ctx.beginPath();
      ring.forEach(([lon, lat]: [number, number], index: number) => {
        const { x, y } = this.latLonToCanvas(lat, lon);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.fill();
    });
  }

  drawPoints(): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    if (this.startPoint) {
      const { x, y } = this.latLonToCanvas(this.startPoint.lat, this.startPoint.lon);
      ctx.fillStyle = 'green';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    this.waypoints.forEach(point => {
      const { x, y } = this.latLonToCanvas(point.lat, point.lon);
      ctx.fillStyle = 'orange';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    });

    if (this.endPoint) {
      const { x, y } = this.latLonToCanvas(this.endPoint.lat, this.endPoint.lon);
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  drawDrone(): void {
    if (!this.dronePosition) return;

    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const { x, y } = this.latLonToCanvas(this.dronePosition.lat, this.dronePosition.lon);
    this.drawPoints();
    ctx.fillStyle = 'blue';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  }

  logCurrentCircleBuffer(buffer: GeoJSON.Feature<GeoJSON.Polygon>, center: [number, number], radiusKm: number): void {
    const timestamp = new Date().toLocaleTimeString();

    // Genera l'output in formato JSON per il buffer corrente
    const bufferOutput = this.generateCombinedBufferOutput({
      type: 'FeatureCollection',
      features: [buffer],
    });

    const logMessage = `[${timestamp}] Buffer Corrente (Centro: [${center[0].toFixed(6)}, ${center[1].toFixed(6)}], Raggio: ${radiusKm} km)\n${JSON.stringify(bufferOutput, null, 2)}`;
    this.currentCircleLogs.push(logMessage);
  }

  logCombinedBufferStep(combinedBuffer: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>): void {
    const timestamp = new Date().toLocaleTimeString();

    const bufferOutput = this.generateCombinedBufferOutput(combinedBuffer);

    const logMessage = `[${timestamp}] Buffer Combinato Progressivo:\n${JSON.stringify(bufferOutput, null, 2)}`;

    this.combinedBufferLogs.push(logMessage);
  }


  canvasToLatLon(x: number, y: number): { lat: number; lon: number } {
    const latRange = this.maxLat - this.minLat;
    const lonRange = this.maxLon - this.minLon;

    const aspectRatio = this.canvasWidth / this.canvasHeight;
    const adjustedLonRange = latRange * aspectRatio;

    const lat = this.maxLat - (y / this.canvasHeight) * latRange;
    const lon = this.minLon + (x / this.canvasWidth) * adjustedLonRange;

    return { lat, lon };
  }

  latLonToCanvas(lat: number, lon: number): { x: number; y: number } {
    const latRange = this.maxLat - this.minLat;
    const lonRange = this.maxLon - this.minLon;

    const aspectRatio = this.canvasWidth / this.canvasHeight;
    const adjustedLonRange = latRange * aspectRatio;

    const x = ((lon - this.minLon) / adjustedLonRange) * this.canvasWidth;
    const y = ((this.maxLat - lat) / latRange) * this.canvasHeight;

    return { x, y };
  }

  downloadCircleLogs(): void {
    const logContent = this.currentCircleLogs.join('\n\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'current_circle_logs.txt';
    link.click();
  }

  downloadCombinedBufferLogs(): void {
    const logContent = this.combinedBufferLogs.join('\n\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'combined_buffer_logs.txt';
    link.click();
  }

  createCircleBuffer(lat: number, lon: number, radiusKm: number): GeoJSON.Feature<GeoJSON.Polygon> | null {
    const point = turf.point([lon, lat]);
    const buffered = turf.buffer(point, radiusKm, {units: 'kilometers'} as any) as unknown as GeoJSON.Feature<GeoJSON.Polygon>;

    return buffered || null;
  }

  drawCombinedCircleBuffer(combinedFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    ctx.save();
    ctx.fillStyle = 'rgba(234,147,170,0.11)';


    combinedFeatureCollection.features.forEach((feature) => {
      if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates.forEach((ring: any) => {
          ctx.beginPath();
          ring.forEach(([lon, lat]: [number, number], index: number) => {
            const { x, y } = this.latLonToCanvas(lat, lon);
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
          ctx.fill();
        });
      } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach((polygon: any) => {
          polygon.forEach((ring: any) => {
            ctx.beginPath();
            ring.forEach(([lon, lat]: [number, number], index: number) => {
              const { x, y } = this.latLonToCanvas(lat, lon);
              if (index === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            });
            ctx.closePath();
            ctx.fill();
          });
        });
      }
    });

    ctx.restore();
  }

}
