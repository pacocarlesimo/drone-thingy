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

  truncatedTangents: [number, number][][][] = [];






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
    const totalSteps = 4;
    const stepsPerSegment = Math.floor(totalSteps / (path.length - 1));

    let step = 0;
    let currentSegment = 0;

    let combinedBuffer: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> = {
      type: 'FeatureCollection',
      features: [],
    };

    this.dronePathCoordinates = [];
    let polygonCoordinates: [number, number][] = []; // Per costruire il poligono finale

    const interval = setInterval(() => {
      if (currentSegment >= path.length - 1) {
        clearInterval(interval);
        this.dronePosition = { ...path[path.length - 1] }; // Imposta la posizione finale del drone
        this.dronePathCoordinates.push([this.dronePosition.lon, this.dronePosition.lat]);

        this.drawPoints();
        this.drawDrone();

        // Disegna il buffer dell'ultima posizione
        const finalBuffer = this.createCircleBuffer(
          this.endPoint!.lat,
          this.endPoint!.lon,
          this.endPoint!.height
        );

        if (finalBuffer) {
          combinedBuffer.features.push(finalBuffer); // Aggiungi l'ultima circonferenza al buffer combinato
          this.drawCombinedCircleBuffer(combinedBuffer); // Disegna il buffer combinato aggiornato
        }

    //    console.log('Buffer combinato finale (GeoJSON):', JSON.stringify(combinedBuffer, null, 2));

        // Disegna le tangenti tra i punti
        this.drawTangentsBetweenCircles(path);


        // Itera su ogni punto per calcolare archi e tangenti
        for (let i = 0; i < path.length; i++) {
          const currentPoint = path[i];
          const previousPoint = i > 0 ? path[i - 1] : null;
          const nextPoint = i < path.length - 1 ? path[i + 1] : null;

          // Calcola le tangenti precedenti e successive
          const tangentsPrevious = previousPoint
            ? this.calculateTangents(
              [previousPoint.lon, previousPoint.lat, previousPoint.height],
              [currentPoint.lon, currentPoint.lat, currentPoint.height]
            )
            : null;

          const tangentsNext = nextPoint
            ? this.calculateTangents(
              [currentPoint.lon, currentPoint.lat, currentPoint.height],
              [nextPoint.lon, nextPoint.lat, nextPoint.height]
            )
            : null;





          if (i === 0 && tangentsNext) {
            const currentCircle = this.createCircleBuffer(currentPoint.lat, currentPoint.lon, currentPoint.height);
            if (currentCircle) {
              const arc = this.getCircularArc(
                // @ts-ignore
                currentCircle.geometry.coordinates[0] as [number, number][],
                tangentsNext[1][0], // Tangente uscente verso il successivo
                tangentsNext[0][0]  // Tangente uscente verso il successivo
              );
              this.drawCircularArc(arc); // Disegna SOLO l'arco esterno
              polygonCoordinates.push(...arc);
            }
          }





          if (i === path.length - 1 && tangentsPrevious) {
            const currentCircle = this.createCircleBuffer(currentPoint.lat, currentPoint.lon, currentPoint.height);
            if (currentCircle) {
              // Calcola l'arco esterno (sezione opposta al poligono)
              const arc = this.getCircularArc(
                // @ts-ignore
                currentCircle.geometry.coordinates[0] as [number, number][],
                tangentsPrevious[0][1], // Tangente entrante dal precedente
                tangentsPrevious[1][1]  // Tangente entrante dal precedente
              );
              this.drawCircularArc(arc);
              polygonCoordinates.push(...arc);
            }
          }
// Gestione dei punti intermedi
          if (i > 0 && i < path.length - 1 && this.truncatedTangents[i - 1] && this.truncatedTangents[i]) {
            const currentCircle = this.createCircleBuffer(currentPoint.lat, currentPoint.lon, currentPoint.height);

            if (currentCircle) {
              // Recupera i punti delle tangenti troncate
              const pointOnPreviousTangent = this.truncatedTangents[i - 1][1][1]; // Punto finale della tangente precedente
              const pointOnNextTangent = this.truncatedTangents[i][0][0]; // Punto iniziale della tangente successiva

              if (
                Array.isArray(pointOnPreviousTangent) &&
                Array.isArray(pointOnNextTangent)
              ) {
                // Calcola l'arco tra i due punti sulla circonferenza
                const arc = this.getCircularArcForIntermediate(
                  currentCircle.geometry.coordinates[0] as [number, number][],
                  pointOnPreviousTangent as unknown as [number, number],
                  pointOnNextTangent as unknown as [number, number]
                );

                // Disegna l'arco in fucsia per evidenziare
                this.drawCircularArcWithColor(arc, 'fuchsia');

                // Aggiungi i punti dell'arco al poligono finale
                polygonCoordinates.push(...arc);
              } else {
                console.error("Errore nei punti delle tangenti troncate", {
                  pointOnPreviousTangent,
                  pointOnNextTangent,
                });
              }
            }
          }





        }

        // Chiudi il poligono
        if (polygonCoordinates.length > 0) {
          polygonCoordinates.push(polygonCoordinates[0]); // Aggiungi il primo punto per chiudere
        }

        // Crea il GeoJSON del poligono
        const polygonGeoJSON: GeoJSON.Feature<GeoJSON.Polygon> = {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [polygonCoordinates],
          },
          properties: {},
        };

       // console.log("GeoJSON del poligono:", JSON.stringify(polygonGeoJSON, null, 2));

        return;
      }

      // Calcola la posizione attuale del drone per l'animazione
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
*/



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
    let polygonCoordinates: [number, number][] = []; // Per costruire il poligono finale

    const interval = setInterval(() => {
      if (currentSegment >= path.length - 1) {
        clearInterval(interval);
        this.dronePosition = { ...path[path.length - 1] }; // Imposta la posizione finale del drone
        this.dronePathCoordinates.push([this.dronePosition.lon, this.dronePosition.lat]);

        this.drawPoints();
        this.drawDrone();

        // Disegna il buffer dell'ultima posizione
        const finalBuffer = this.createCircleBuffer(
          this.endPoint!.lat,
          this.endPoint!.lon,
          this.endPoint!.height
        );

        if (finalBuffer) {
          combinedBuffer.features.push(finalBuffer); // Aggiungi l'ultima circonferenza al buffer combinato
          this.drawCombinedCircleBuffer(combinedBuffer); // Disegna il buffer combinato aggiornato
        }

        // Disegna le tangenti tra i punti
        this.drawTangentsBetweenCircles(path);

        // Itera su ogni punto per calcolare archi e tangenti
        for (let i = 0; i < path.length; i++) {
          const currentPoint = path[i];

          // Usa `this.truncatedTangents` per ottenere le tangenti
          const previousTangents = i > 0 ? this.truncatedTangents[i - 1] : null;
          const nextTangents = i < path.length - 1 ? this.truncatedTangents[i] : null;

          // Primo punto (solo arco esterno verso il successivo)
          if (i === 0 && nextTangents) {
            const currentCircle = this.createCircleBuffer(currentPoint.lat, currentPoint.lon, currentPoint.height);
            if (currentCircle) {
              const arc = this.getCircularArc(
                // @ts-ignore
                currentCircle.geometry.coordinates[0] as [number, number][],
                nextTangents[1][0], // Tangente uscente verso il successivo
                nextTangents[0][0]  // Tangente uscente verso il successivo
              );
              this.drawCircularArc(arc); // Disegna SOLO l'arco esterno
              polygonCoordinates.push(...arc);
            }
          }

          // Ultimo punto (solo arco esterno dal precedente)
          if (i === path.length - 1 && previousTangents) {
            const currentCircle = this.createCircleBuffer(currentPoint.lat, currentPoint.lon, currentPoint.height);
            if (currentCircle) {
              const arc = this.getCircularArc(
                // @ts-ignore
                currentCircle.geometry.coordinates[0] as [number, number][],
                previousTangents[0][1], // Tangente entrante dal precedente
                previousTangents[1][1]  // Tangente entrante dal precedente
              );
              this.drawCircularArc(arc);
              polygonCoordinates.push(...arc);
            }
          }

          // Punti intermedi (usando le tangenti troncate)
          if (i > 0 && i < path.length - 1 && previousTangents && nextTangents) {
            const currentCircle = this.createCircleBuffer(currentPoint.lat, currentPoint.lon, currentPoint.height);

            if (currentCircle) {
              const pointOnPreviousTangent = previousTangents[1][1]; // Punto finale della tangente precedente
              const pointOnNextTangent = nextTangents[0][0]; // Punto iniziale della tangente successiva

              if (Array.isArray(pointOnPreviousTangent) && Array.isArray(pointOnNextTangent)) {
                const arc = this.getCircularArcForIntermediate(
                  currentCircle.geometry.coordinates[0] as [number, number][],
                  pointOnPreviousTangent,
                  pointOnNextTangent
                );

                // Disegna l'arco in fucsia per evidenziare
                this.drawCircularArcWithColor(arc, 'fuchsia');

                // Aggiungi i punti dell'arco al poligono finale
                polygonCoordinates.push(...arc);
              } else {
                console.error("Errore nei punti delle tangenti troncate", {
                  pointOnPreviousTangent,
                  pointOnNextTangent,
                });
              }
            }
          }
        }

        // Chiudi il poligono
        if (polygonCoordinates.length > 0) {
          polygonCoordinates.push(polygonCoordinates[0]); // Aggiungi il primo punto per chiudere
        }

        // Crea il GeoJSON del poligono
        const polygonGeoJSON: GeoJSON.Feature<GeoJSON.Polygon> = {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [polygonCoordinates],
          },
          properties: {},
        };

        return;
      }

      // Calcola la posizione attuale del drone per l'animazione
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
  }






















  /*
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
    }*/

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
   //   console.error('Le circonferenze si sovrappongono o una contiene l\'altra.');
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

  drawTangents(tangents: [number, number][][]): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2;

    tangents.forEach(([start, end], index) => {
      const { x: x1, y: y1 } = this.latLonToCanvas(start[1], start[0]);
      const { x: x2, y: y2 } = this.latLonToCanvas(end[1], end[0]);

      ctx.strokeStyle = index % 2 === 0 ? 'blue' : 'black'; // Blu per esterne, nero per interne
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

  //    console.log(`Tangente ${index}: (${start[0]}, ${start[1]}) -> (${end[0]}, ${end[1]}) disegnata.`);
    });
  }

// Calcola l'intersezione tra due segmenti
  calculateLineIntersection(
    line1Start: [number, number],
    line1End: [number, number],
    line2Start: [number, number],
    line2End: [number, number]
  ): [number, number] | null {
    const [x1, y1] = line1Start;
    const [x2, y2] = line1End;
    const [x3, y3] = line2Start;
    const [x4, y4] = line2End;

    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denominator === 0) {
  //    console.log('Le linee sono parallele o coincidenti.');
      return null;
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denominator;

    if (t < 0 || t > 1 || u < 0 || u > 1) {
  //    console.log('Intersezione al di fuori dei limiti dei segmenti.');
      return null;
    }

    const px = x1 + t * (x2 - x1);
    const py = y1 + t * (y2 - y1);

    return [px, py];
  }

// Disegna un punto sul canvas
  drawPoint(point: [number, number], color: string = 'green'): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
//      console.error('Contesto del canvas non trovato.');
      return;
    }

    const { x, y } = this.latLonToCanvas(point[1], point[0]);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
/*
  drawTangentsBetweenCircles(path: { lat: number; lon: number; height: number }[]): void {
    const allTangents: [number, number][][] = [];
    const intersections: { tangentIndex1: number; tangentIndex2: number; intersection: [number, number] }[] = [];

    // Calcola tutte le tangenti tra le coppie di cerchi
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      const tangents = this.calculateTangents(
        [start.lon, start.lat, start.height],
        [end.lon, end.lat, end.height]
      );
      allTangents.push(...tangents);
    }

    // Calcola tutte le intersezioni tra ogni coppia di tangenti
  //  console.log("Calcolo delle intersezioni tra tutte le tangenti...");
    for (let i = 0; i < allTangents.length; i++) {
      for (let j = i + 1; j < allTangents.length; j++) {
        const [start1, end1] = allTangents[i];
        const [start2, end2] = allTangents[j];

        const intersection = this.calculateLineIntersection(start1, end1, start2, end2);

        if (intersection) {
   //       console.log(`Intersezione trovata tra Tangente ${i} e Tangente ${j}: (${intersection[0]}, ${intersection[1]})`);
          intersections.push({ tangentIndex1: i, tangentIndex2: j, intersection });

          // Modifica immediatamente le tangenti per preservare le parti esterne
          if (this.calculateDistance(end1, intersection) > this.calculateDistance(start1, intersection)) {
            allTangents[i][0] = intersection; // Mantieni la parte esterna (lontana dall'inizio)
          } else {
            allTangents[i][1] = intersection; // Mantieni la parte esterna (lontana dalla fine)
          }

          if (this.calculateDistance(end2, intersection) > this.calculateDistance(start2, intersection)) {
            allTangents[j][0] = intersection; // Mantieni la parte esterna (lontana dall'inizio)
          } else {
            allTangents[j][1] = intersection; // Mantieni la parte esterna (lontana dalla fine)
          }
        }
      }
    }

    this.truncatedTangents = [...allTangents];

    console.log('Tangenti troncate:', this.truncatedTangents);

    // Disegna tutte le tangenti modificate e i punti di intersezione
    this.drawTangents(allTangents);
    intersections.forEach(({ intersection }) => {
      this.drawPoint(intersection, 'green'); // Disegna i punti di intersezione
    });

 //   console.log("Processo completato: tutte le tangenti e intersezioni calcolate.");
  } */

  drawTangentsBetweenCircles(path: { lat: number; lon: number; height: number }[]): void {
    this.truncatedTangents = []; // Reset della variabile globale
    const allTangents: [number, number][][] = [];
    const intersections: { tangentIndex1: number; tangentIndex2: number; intersection: [number, number] }[] = [];

    // Calcola tutte le tangenti tra le coppie di cerchi
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      const tangents = this.calculateTangents(
        [start.lon, start.lat, start.height],
        [end.lon, end.lat, end.height]
      );

      // Manteniamo le tangenti originali
      this.truncatedTangents.push([...tangents]);

      allTangents.push(...tangents);
    }

    // Calcola tutte le intersezioni tra ogni coppia di tangenti
    for (let i = 0; i < allTangents.length; i++) {
      for (let j = i + 1; j < allTangents.length; j++) {
        const [start1, end1] = allTangents[i];
        const [start2, end2] = allTangents[j];

        const intersection = this.calculateLineIntersection(start1, end1, start2, end2);

        if (intersection) {
          intersections.push({ tangentIndex1: i, tangentIndex2: j, intersection });

          // Modifica immediatamente le tangenti per preservare le parti esterne
          if (this.calculateDistance(end1, intersection) > this.calculateDistance(start1, intersection)) {
            allTangents[i][0] = intersection; // Mantieni la parte esterna (lontana dall'inizio)
          } else {
            allTangents[i][1] = intersection; // Mantieni la parte esterna (lontana dalla fine)
          }

          if (this.calculateDistance(end2, intersection) > this.calculateDistance(start2, intersection)) {
            allTangents[j][0] = intersection; // Mantieni la parte esterna (lontana dall'inizio)
          } else {
            allTangents[j][1] = intersection; // Mantieni la parte esterna (lontana dalla fine)
          }
        }
      }
    }

    // Aggiorna `truncatedTangents` con le tangenti troncate
    for (let i = 0; i < this.truncatedTangents.length; i++) {
      this.truncatedTangents[i] = [
        allTangents[i * 2], // Tangente esterna 1
        allTangents[i * 2 + 1], // Tangente esterna 2
      ];
    }

    // Disegna tutte le tangenti modificate
    this.drawTangents(allTangents);

    // Disegna i punti di intersezione
    intersections.forEach(({ intersection }) => {
      this.drawPoint(intersection, 'green'); // Disegna i punti di intersezione
    });
  }


  calculateDistance(point1: [number, number], point2: [number, number]): number {
    const [x1, y1] = point1;
    const [x2, y2] = point2;

    // Formula della distanza euclidea
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

 //   console.log(`Distanza calcolata tra (${x1}, ${y1}) e (${x2}, ${y2}): ${distance.toFixed(6)}`);
    return distance;
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
  //    console.error('Buffering failed or returned an empty FeatureCollection.');
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

    // Calcolo della latitudine provvisoria
    const lat = this.maxLat - (y / this.canvasHeight) * latRange;

    // Fattore di correzione longitudinale basato sulla latitudine provvisoria
    const latCorrection = Math.cos((lat * Math.PI) / 180);

    const adjustedLonRange = latRange * aspectRatio;

    const lon = this.minLon + (x / (this.canvasWidth * latCorrection)) * adjustedLonRange;

    return { lat, lon };
  }


  latLonToCanvas(lat: number, lon: number): { x: number; y: number } {
    const latRange = this.maxLat - this.minLat;
    const lonRange = this.maxLon - this.minLon;

    const aspectRatio = this.canvasWidth / this.canvasHeight;

    // Fattore di correzione per la longitudine basato sulla latitudine
    const latCorrection = Math.cos((lat * Math.PI) / 180);

    const adjustedLonRange = latRange * aspectRatio;

    const x = ((lon - this.minLon) / adjustedLonRange) * this.canvasWidth * latCorrection;
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

  getCircularArc(
    circle: [number, number][],
    tangentStart: [number, number],
    tangentEnd: [number, number]
  ): [number, number][] {
    // Trova l'indice del punto sulla circonferenza più vicino a un certo punto
    const findClosestIndex = (target: [number, number]) => {
      let closestIndex = -1;
      let minDistance = Number.MAX_VALUE;

      circle.forEach(([lon, lat], index) => {
        const distance = Math.sqrt(
          Math.pow(lon - target[0], 2) + Math.pow(lat - target[1], 2) // Distanza euclidea
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });

      return closestIndex;
    };

    // Trova gli indici dei punti sulla circonferenza più vicini alle tangenti
    const startIndex = findClosestIndex(tangentStart);
    const endIndex = findClosestIndex(tangentEnd);

    if (startIndex === -1 || endIndex === -1) {
      console.error("Errore nella selezione dei punti dell'arco.");
      return [];
    }

    // Genera l'arco interno tra i punti sulle tangenti
    const createInternalArc = (fromIndex: number, toIndex: number): [number, number][] => {
      const arc: [number, number][] = [];
      let index = fromIndex;

      // Muoviti in senso orario per creare il segmento interno, fino al toIndex
      do {
        arc.push(circle[index]);
        index = (index + 1) % circle.length; // Passa al prossimo punto in senso orario
      } while (index !== toIndex);

      arc.push(circle[toIndex]); // Aggiungi l'ultimo punto

      return arc;
    };

    // Crea l'arco interno
    return createInternalArc(startIndex, endIndex);
  }

  getCircularArcForIntermediate(
    circleCoordinates: [number, number][],
    startPoint: [number, number],
    endPoint: [number, number]
  ): [number, number][] {
    const startIndex = circleCoordinates.findIndex(
      ([lon, lat]) => lon === startPoint[0] && lat === startPoint[1]
    );
    const endIndex = circleCoordinates.findIndex(
      ([lon, lat]) => lon === endPoint[0] && lat === endPoint[1]
    );

    if (startIndex === -1 || endIndex === -1) {
      console.error("Punti di partenza o arrivo non trovati sulla circonferenza");
      return [];
    }

    if (startIndex <= endIndex) {
      return circleCoordinates.slice(startIndex, endIndex + 1);
    } else {
      return [
        ...circleCoordinates.slice(startIndex),
        ...circleCoordinates.slice(0, endIndex + 1),
      ];
    }
  }


  drawCircularArcWithColor(arc: [number, number][], color: string): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    arc.forEach(([lon, lat], index) => {
      const { x, y } = this.latLonToCanvas(lat, lon);
      if (index === 0) {
        ctx.moveTo(x, y); // Inizio dell'arco
      } else {
        ctx.lineTo(x, y); // Segmento successivo dell'arco
      }
    });

    ctx.strokeStyle = color; // Usa il colore passato come parametro
    ctx.lineWidth = 2;
    ctx.stroke();
  }




  drawCircularArc(arc: [number, number][]): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    arc.forEach(([lon, lat], index) => {
      const { x, y } = this.latLonToCanvas(lat, lon);
      if (index === 0) {
        ctx.moveTo(x, y); // Inizio dell'arco
      } else {
        ctx.lineTo(x, y); // Segmento successivo dell'arco
      }
    });

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

}
