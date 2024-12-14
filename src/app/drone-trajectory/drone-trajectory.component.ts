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

  /*
  simulateDroneMovement(): void {
    if (!this.startPoint || !this.endPoint) {
      alert('Seleziona prima i punti di partenza e arrivo cliccando sulla mappa.');
      return;
    }

    const path = [this.startPoint, ...this.waypoints, this.endPoint];
    let polygonCoordinates: [number, number][] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const current = path[i];
      const next = path[i + 1];

      // Calcola solo gli archi esterni
      const { arcs } = this.calculateTangentsAndArcs(
        [current.lon, current.lat, current.height],
        [next.lon, next.lat, next.height]
      );

      if (arcs.length === 2) {
        // Aggiungi gli archi esterni al poligono
        polygonCoordinates.push(...arcs[0], ...arcs[1]);
      } else {
        console.error('Errore durante il calcolo degli archi.');
      }
    }

    // Disegna il poligono risultante
    this.drawPolygon(polygonCoordinates);
  } */



  simulateDroneMovement(): void {
    if (!this.startPoint || !this.endPoint) {
      alert('Seleziona prima i punti di partenza e arrivo cliccando sulla mappa.');
      return;
    }

    const path = [this.startPoint, ...this.waypoints, this.endPoint];
    const totalSteps = 4;
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
        this.dronePosition = { ...path[path.length - 1] }; // Imposta la posizione finale del drone
        this.dronePathCoordinates.push([this.dronePosition.lon, this.dronePosition.lat]);

        this.drawPoints();
        this.drawDrone();

        // Disegna l'ultima circonferenza
        const finalBuffer = this.createCircleBuffer(
          this.endPoint!.lat,
          this.endPoint!.lon,
          this.endPoint!.height
        );

        if (finalBuffer) {
          combinedBuffer.features.push(finalBuffer); // Aggiungi l'ultima circonferenza al buffer combinato
          this.drawCombinedCircleBuffer(combinedBuffer); // Disegna il buffer combinato aggiornato
        }

        console.log('Buffer combinato finale (GeoJSON):', JSON.stringify(combinedBuffer, null, 2));

        // Calcola e disegna le tangenti finali
        this.drawTangentsBetweenCircles(path);

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

// Metodo per calcolare e disegnare le tangenti tra le circonferenze
  drawTangentsBetweenCircles(path: { lat: number; lon: number; height: number }[]): void {
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];

      const tangents = this.calculateTangents(
        [start.lon, start.lat, start.height],
        [end.lon, end.lat, end.height]
      );

      if (tangents.length > 0) {
        this.drawTangents(tangents);
      }
    }
  }

  calculateTangents(
    start: [number, number, number], // [lon, lat, radius]
    end: [number, number, number]   // [lon, lat, radius]
  ): [number, number][][] {
    const [lon1, lat1, r1] = start;
    const [lon2, lat2, r2] = end;

    // Crea i punti come Feature<Point>
    const startPoint = turf.point([lon1, lat1]);
    const endPoint = turf.point([lon2, lat2]);

    // Calcola la distanza tra i centri
    const d = turf.distance(startPoint, endPoint, { units: 'kilometers' } as any);

    if (d <= Math.abs(r1 - r2)) {
      console.error('Le circonferenze si sovrappongono o una contiene l\'altra.');
      return [];
    }

    // Calcolo degli angoli
    const centerAngle = turf.bearing(startPoint, endPoint);
    const tangentAngle = Math.acos((r1 - r2) / d) * (180 / Math.PI); // Angolo in gradi

    // Calcola le tangenti
    const tangent1Start = turf.destination(startPoint, r1, centerAngle + tangentAngle, { units: 'kilometers' } as any);
    const tangent1End = turf.destination(endPoint, r2, centerAngle + tangentAngle, { units: 'kilometers' } as any);

    const tangent2Start = turf.destination(startPoint, r1, centerAngle - tangentAngle, { units: 'kilometers' } as any);
    const tangent2End = turf.destination(endPoint, r2, centerAngle - tangentAngle, { units: 'kilometers' } as any);

    // Ritorna i punti di tangenza come coordinate
    return [
      [
        tangent1Start.geometry.coordinates as [number, number],
        tangent1End.geometry.coordinates as [number, number],
      ],
      [
        tangent2Start.geometry.coordinates as [number, number],
        tangent2End.geometry.coordinates as [number, number],
      ],
    ];
  }



// Metodo per disegnare le tangenti
  drawTangents(tangents: [number, number][][]): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;

    tangents.forEach(([start, end]) => {
      const { x: x1, y: y1 } = this.latLonToCanvas(start[1], start[0]);
      const { x: x2, y: y2 } = this.latLonToCanvas(end[1], end[0]);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
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


  calculateTangentsAndArcs(
    start: [number, number, number], // [lon, lat, radius]
    end: [number, number, number]   // [lon, lat, radius]
  ): { arcs: [number, number][][] } {
    const [lon1, lat1, r1] = start;
    const [lon2, lat2, r2] = end;

    // Crea i punti come Feature<Point>
    const startPoint = turf.point([lon1, lat1]);
    const endPoint = turf.point([lon2, lat2]);

    // Calcola la distanza tra i centri
    const d = turf.distance(startPoint, endPoint, { units: 'kilometers' } as any);

    if (d <= Math.abs(r1 - r2)) {
      console.error('Le circonferenze si sovrappongono o una contiene l\'altra.');
      return { arcs: [] };
    }

    // Calcolo degli angoli
    const centerAngle = turf.bearing(startPoint, endPoint);
    const tangentAngle = Math.acos((r1 - r2) / d) * (180 / Math.PI); // Angolo in gradi

    // Calcola le tangenti
    const tangent1Start = turf.destination(startPoint, r1, centerAngle + tangentAngle, { units: 'kilometers' } as any);
    const tangent1End = turf.destination(endPoint, r2, centerAngle + tangentAngle, { units: 'kilometers' } as any);

    const tangent2Start = turf.destination(startPoint, r1, centerAngle - tangentAngle, { units: 'kilometers' } as any);
    const tangent2End = turf.destination(endPoint, r2, centerAngle - tangentAngle, { units: 'kilometers' } as any);

    // Calcola gli archi esterni (quelli tra i punti delle tangenti)
    const circle1 = this.createCircle(lon1, lat1, r1);
    const circle2 = this.createCircle(lon2, lat2, r2);

    // Otteniamo solo gli archi esterni
    const arc1 = this.getArcBetweenPoints(
      circle1,
      tangent2Start.geometry.coordinates as [number, number],
      tangent1Start.geometry.coordinates as [number, number]
    );

    const arc2 = this.getArcBetweenPoints(
      circle2,
      tangent1End.geometry.coordinates as [number, number],
      tangent2End.geometry.coordinates as [number, number]
    );

    return { arcs: [arc1, arc2] };
  }

  getArcBetweenPoints(
    circle: [number, number][],
    start: [number, number],
    end: [number, number]
  ): [number, number][] {
    // Trova l'indice dei punti iniziale e finale nella circonferenza
    const startIndex = circle.findIndex(([lon, lat]) => Math.abs(lon - start[0]) < 1e-6 && Math.abs(lat - start[1]) < 1e-6);
    const endIndex = circle.findIndex(([lon, lat]) => Math.abs(lon - end[0]) < 1e-6 && Math.abs(lat - end[1]) < 1e-6);

    if (startIndex === -1 || endIndex === -1) {
      console.error('Punti di tangenza non trovati nella circonferenza.');
      return [];
    }

    // Estrai i punti tra startIndex e endIndex
    if (startIndex < endIndex) {
      return circle.slice(startIndex, endIndex + 1); // In senso antiorario
    } else {
      return [...circle.slice(startIndex), ...circle.slice(0, endIndex + 1)]; // Wrap-around
    }
  }

  drawArcs(arcs: [number, number][][]): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    arcs.forEach((arc) => {
      ctx.beginPath();
      arc.forEach(([lon, lat], index) => {
        const { x, y } = this.latLonToCanvas(lat, lon);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  createCircle(lon: number, lat: number, radius: number): [number, number][] {
    const point = turf.point([lon, lat]); // Crea un Feature<Point>
    const circle = turf.circle(point, radius, { steps: 64, units: 'kilometers' } as any); // Passa direttamente il punto
    return circle.geometry.coordinates[0] as [number, number][];
  }

  drawPolygon(coordinates: [number, number][]): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    coordinates.forEach(([lon, lat], index) => {
      const { x, y } = this.latLonToCanvas(lat, lon);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
