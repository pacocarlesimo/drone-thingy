import { Component, OnInit } from '@angular/core';
import * as turf from '@turf/turf';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {Feature, GeoJSON, LineString} from 'geojson';
import flatten from '@turf/flatten';


@Component({
  selector: 'app-drone-trajectory',
  templateUrl: './drone-trajectory.component.html',
  imports: [FormsModule, CommonModule],
  styleUrls: ['./drone-trajectory.component.css']
})
export class DroneTrajectoryComponent implements OnInit {
  canvasWidth: number = 1200;
  canvasHeight: number = 800;

  minLat: number = 40.0;
  maxLat: number = 41.0;
  minLon: number = 10.0;
  maxLon: number = 11.0;

  startPoint: { lat: number; lon: number; height: number } | null = null;
  endPoint: { lat: number; lon: number; height: number } | null = null;
  waypoints: { lat: number; lon: number; height: number }[] = [];
  dronePosition: { lat: number; lon: number; height: number } | null = null;
  combinedBuffer: GeoJSON.Feature<GeoJSON.Polygon> | null = null;

  startHeight: number = 20;
  endHeight: number = 10;

  droneLogs: string[] = [];
  impactLogs: string[] = [];
  impactBufferCoordinates: any[] = [];

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

 /* simulateDroneMovement(): void {
    if (!this.startPoint || !this.endPoint) {
      alert('Seleziona prima i punti di partenza e arrivo cliccando sulla mappa.');
      return;
    }

    const path = [this.startPoint, ...this.waypoints, this.endPoint];
    const totalSteps = 200;
    const stepsPerSegment = Math.floor(totalSteps / (path.length - 1));

    let step = 0;
    let currentSegment = 0;

    // Inizializza combinedBuffer come una FeatureCollection
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

        // Disegna il buffer finale
        this.drawCombinedCircleBuffer(combinedBuffer);

        setTimeout(() => alert('Drone arrivato al punto di arrivo!'), 500);
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

      this.logDronePosition(lat, lon, height);
      this.drawDrone();

      const currentBuffer = this.createCircleBuffer(lat, lon, height);

      if (currentBuffer) {
        try {
          // Aggiungi il nuovo poligono al FeatureCollection
          combinedBuffer.features.push(currentBuffer);

          // Disegna il buffer combinato aggiornato
          this.drawCombinedCircleBuffer(combinedBuffer);
        } catch (error) {
          console.error('Errore durante la combinazione dei buffer:', error);
        }
      }

      step++;
      if (step % stepsPerSegment === 0) {
        currentSegment++;
      }
    }, 100);
  }*/

  simulateDroneMovement(): void {
    if (!this.startPoint || !this.endPoint) {
      alert('Seleziona prima i punti di partenza e arrivo cliccando sulla mappa.');
      return;
    }

    const path = [this.startPoint, ...this.waypoints, this.endPoint];
    const totalSteps = 200;
    const stepsPerSegment = Math.floor(totalSteps / (path.length - 1));

    let step = 0;
    let currentSegment = 0;

    // Inizializza combinedBuffer come una FeatureCollection
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

        // Disegna il buffer finale
        this.drawCombinedCircleBuffer(combinedBuffer);

        // Stampa l'output finale delle coordinate
        const finalBufferOutput = this.generateCombinedBufferOutput(combinedBuffer);
        console.log('Buffer Combinato Finale (JSON):', JSON.stringify(finalBufferOutput, null, 2));

        setTimeout(() => alert('Drone arrivato al punto di arrivo!'), 500);
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

      this.logDronePosition(lat, lon, height);
      this.drawDrone();

      const currentBuffer = this.createCircleBuffer(lat, lon, height);

      if (currentBuffer) {
        try {
          // Aggiungi il nuovo poligono al FeatureCollection
          combinedBuffer.features.push(currentBuffer);

          // Disegna il buffer combinato aggiornato
          this.drawCombinedCircleBuffer(combinedBuffer);

          // Stampa l'output aggiornato del buffer combinato
          const bufferOutput = this.generateCombinedBufferOutput(combinedBuffer);
          console.log('Buffer Combinato (JSON):', JSON.stringify(bufferOutput, null, 2));
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

    // Itera su ogni feature nella FeatureCollection
    buffer.features.forEach((feature) => {
      if (feature.geometry.type === 'Polygon') {
        // Se è un poligono, estrai le coordinate
        feature.geometry.coordinates.forEach((ring) => {
          ring.forEach((coordinate) => {
            // Aggiungi coordinate come [x, y, z] con z = 0
            output.push([coordinate[0], coordinate[1], 0]);
          });
        });
      } else if (feature.geometry.type === 'MultiPolygon') {
        // Se è un MultiPolygon, estrai i poligoni interni
        feature.geometry.coordinates.forEach((polygon) => {
          polygon.forEach((ring) => {
            ring.forEach((coordinate) => {
              // Aggiungi coordinate come [x, y, z] con z = 0
              output.push([coordinate[0], coordinate[1], 0]);
            });
          });
        });
      }
    });

    return output;
  }

  /*

    simulateDroneMovement(): void {
      if (!this.startPoint || !this.endPoint) {
        alert('Seleziona prima i punti di partenza e arrivo cliccando sulla mappa.');
        return;
      }

      const path = [this.startPoint, ...this.waypoints, this.endPoint];
      const totalSteps = 200;
      const stepsPerSegment = Math.floor(totalSteps / (path.length - 1));

      let step = 0;
      let currentSegment = 0;

      let combinedBuffer: GeoJSON.Feature<GeoJSON.Polygon> | null = null;

      this.dronePathCoordinates = [];

      const interval = setInterval(() => {
        if (currentSegment >= path.length - 1) {
          clearInterval(interval);
          this.dronePosition = { ...path[path.length - 1] };
          this.dronePathCoordinates.push([this.dronePosition.lon, this.dronePosition.lat]);

          this.drawPoints();
          this.drawDrone();
          this.updateDronePathBuffer();

          // Disegna il buffer finale
          if (combinedBuffer) {
            this.drawCombinedCircleBuffer(combinedBuffer);
          }

          setTimeout(() => alert('Drone arrivato al punto di arrivo!'), 500);
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

        this.logDronePosition(lat, lon, height);
        this.drawDrone();

        // Calcola il buffer circolare corrente
        const currentBuffer = this.createCircleBuffer(lat, lon, height);

        // Combina il buffer corrente con quelli precedenti
        if (currentBuffer) {
          combinedBuffer = combinedBuffer
            ? turf.union(combinedBuffer, currentBuffer)  as GeoJSON.Feature<GeoJSON.Polygon>
            : currentBuffer;
        }

        // Disegna il buffer unito
        if (combinedBuffer) {
          this.drawCombinedCircleBuffer(combinedBuffer);
        }

        step++;
        if (step % stepsPerSegment === 0) {
          currentSegment++;
        }
      }, 100);
    } */


  zoomIn(): void {
    this.zoomLevel *= 1.2;
    this.redrawMap();
  }

  zoomOut(): void {
    this.zoomLevel /= 1.2;
    this.redrawMap();
  }

  redrawMap(): void {
    this.drawPoints();
    if (this.dronePosition) {
      this.drawDrone();
      this.drawImpactArea(
        this.dronePosition.lat,
        this.dronePosition.lon,
        this.dronePosition.height
      );
      //this.updateDronePathBuffer();
    }
  }

  updateDronePathBuffer(): void {
    if (this.dronePathCoordinates.length < 2) {
      return; // Non possiamo calcolare un buffer con meno di 2 punti
    }

    // Create LineString from the drone path coordinates
    const line = turf.lineString(this.dronePathCoordinates);

    // Wrap the LineString in a FeatureCollection
    const featureCollection = turf.featureCollection([line]);

    // Define the buffer options with kilometers
    const bufferOptions: { units: 'kilometers' } = { units: 'kilometers' };

    // Compute the buffer (returns a FeatureCollection)
    const bufferedFeatureCollection = turf.buffer(featureCollection, 0.1, bufferOptions as any);

    if (bufferedFeatureCollection && bufferedFeatureCollection.features.length > 0) {
      // Extract the first feature (assuming it's a Polygon)
      const bufferedPolygon = bufferedFeatureCollection.features[0] as GeoJSON.Feature<GeoJSON.Polygon>;

      // Pass the polygon to drawDronePathBuffer
      this.drawDronePathBuffer(bufferedPolygon);
    } else {
      console.error('Buffering failed or returned an empty FeatureCollection.');
    }
  }

  drawDronePathBuffer(bufferedLine: GeoJSON.Feature<GeoJSON.Polygon>): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight); // Cancella la mappa

    this.redrawMap(); // Ridisegna la mappa
    ctx.fillStyle = 'rgba(0, 0, 255, 0.2)'; // Colore semi-trasparente per il buffer

    // Disegnare il buffer (fatto di un poligono con un array di coordinate)
    bufferedLine.geometry.coordinates.forEach((ring: any) => {
      ctx.beginPath();
      ring.forEach(([lon, lat]: [number, number], index: number) => {
        const { x, y } = this.latLonToCanvas(lat, lon); // Conversione da lat/lon a canvas
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

  drawImpactArea(lat: number, lon: number, height: number): void {
    const bufferRadiusKm = height * this.zoomLevel;

    // Create a point
    const point = turf.point([lon, lat]);

    // Wrap the point in a FeatureCollection
    const featureCollection = turf.featureCollection([point]);

    // Buffer the FeatureCollection
    const buffered = turf.buffer(featureCollection, bufferRadiusKm, { units: 'kilometers' } as any);

    if (!buffered) {
      console.error('Errore nel calcolo del buffer: buffered è undefined.');
      return;
    }

    this.logImpactArea(lat, lon, bufferRadiusKm, buffered.features[0]?.geometry.coordinates);

    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const { x, y } = this.latLonToCanvas(lat, lon);

    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x, y, this.kmToCanvasRadius(bufferRadiusKm), 0, 2 * Math.PI);
    ctx.fill();
  }

  kmToCanvasRadius(km: number): number {
    const kmPerPixel = (this.maxLat - this.minLat) * 111 / this.canvasHeight;
    return (km / kmPerPixel) * this.zoomLevel;
  }

  logImpactArea(lat: number, lon: number, radiusKm: number, bufferCoordinates: any): void {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] Centro Area Di Impatto: (lat: ${lat.toFixed(6)}, lon: ${lon.toFixed(6)}), raggio: ${radiusKm.toFixed(2)} km`;
    this.impactLogs.push(logMessage);

    this.impactBufferCoordinates.push(bufferCoordinates);
  }

  logDronePosition(lat: number, lon: number, height: number): void {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] Posizione Del Drone: (lat: ${lat.toFixed(6)}, lon: ${lon.toFixed(6)}, altezza: ${height.toFixed(2)} km)`;
    this.droneLogs.push(logMessage);
  }

  canvasToLatLon(x: number, y: number): { lat: number; lon: number } {
    const lat = this.maxLat - (y / this.canvasHeight) * (this.maxLat - this.minLat);
    const lon = this.minLon + (x / this.canvasWidth) * (this.maxLon - this.minLon);
    return { lat, lon };
  }

  latLonToCanvas(lat: number, lon: number): { x: number; y: number } {
    const x = ((lon - this.minLon) / (this.maxLon - this.minLon)) * this.canvasWidth;
    const y = ((this.maxLat - lat) / (this.maxLat - this.minLat)) * this.canvasHeight;
    return { x, y };
  }
  downloadLogs(): void {
    const logContent = [...this.droneLogs, ...this.impactLogs].join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'drone_logs.txt';
    link.click();
  }

  updateCircleBuffer(lat: number, lon: number, radiusKm: number): void {
    // Create the geographic point for the circle's center
    const point = turf.point([lon, lat]);

    // Wrap the point in a FeatureCollection (opzionale per coerenza con il case drone)
    const featureCollection = turf.featureCollection([point]);

    // Define the buffer options (raggio in chilometri)
    const bufferOptions: { units: 'kilometers' } = { units: 'kilometers' };

    // Compute the buffer around the point (returns a Polygon)
    const bufferedPolygon = turf.buffer(featureCollection, radiusKm, bufferOptions as any) as unknown as GeoJSON.Feature<GeoJSON.Polygon>;

    if (bufferedPolygon) {
      // Pass the polygon to the drawCircleBuffer function
      this.drawCircleBuffer(bufferedPolygon);
    } else {
      console.error('Buffer creation failed or returned undefined.');
    }
  }

  drawCircleBuffer(bufferedCircle: GeoJSON.Feature<GeoJSON.Polygon>): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    // NON cancelliamo nulla qui, disegniamo sopra
    ctx.save();

    ctx.fillStyle = 'rgba(255, 182, 193, 0.4)'; // Colore semi-trasparente

    // Disegna il poligono buffer
    bufferedCircle.geometry.coordinates.forEach((ring: any) => {
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

    ctx.restore();
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
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'; // Verde semi-trasparente per il buffer

    // Itera su ogni feature del FeatureCollection
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
