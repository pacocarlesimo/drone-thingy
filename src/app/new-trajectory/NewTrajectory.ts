import { Component, OnInit } from '@angular/core';
import * as turf from '@turf/turf';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GeoJSON } from 'geojson';

type Tangent = {
  start: [number, number];
  end: [number, number];
  truncated: boolean; // Indica se la tangente è passata per il processo di check sulle intersezioni
  tagliataSuOrigine: boolean,
  tagliataSuDestinazione: boolean
};

/*TODO
*
* GESTIONE PER PUNTI INTERMEDI CON CIRCONFERENZA CHE RICHIEDE DUE ARCHI
*
* ELIMINARE / EVITARE CHE SI FORMI COLLEGAMENTO INTERNO TRA I PUNTI DELLA RICONFERENZA IN CREAZIONE DELL'ARCO PER CAUSE ANCORA NON CHIARE
*
* COLLEGARE EFFETTIVAMENTE TUTTE LE LINEE DEL GEOJSON PER OTTENERE UNA FIGURA CHIUSA
*
* */

@Component({
  selector: 'app-new-trajectory',
  templateUrl: './NewTrajectory.html',
  imports: [FormsModule, CommonModule],
  styleUrls: ['./NewTrajectory.css']
})
export class NewTrajectoryComponent implements OnInit {
  canvasWidth: number = 1200;
  canvasHeight: number = 800;

  minLat: number = 41.7;
  maxLat: number = 42.1;
  minLon: number = 12.3;
  maxLon: number = 12.7;
  startHeight: number = 5;
  endHeight: number = 3;

  startPoint: { lat: number; lon: number; height: number } | null = null;
  endPoint: { lat: number; lon: number; height: number } | null = null;
  waypoints: { lat: number; lon: number; height: number }[] = [];

  circleTangents: {
    circle: GeoJSON.Feature<GeoJSON.Polygon>;
    outgoingTangents: [Tangent | null, Tangent | null];
  }[] = [];
  savedArcs: { circleIndex: number; arcPoints: [number, number][] }[] = [];
  ngOnInit(): void {
  }

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
      const height = prompt("Inserisci l'altezza (km) per questo punto:", "1");
      if (height !== null) {
        this.waypoints.push({ lat, lon, height: parseFloat(height) });
        this.drawPoints();
      }
    }
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

  latLonToCanvas(lat: number, lon: number): { x: number; y: number } {
    const latRange = this.maxLat - this.minLat;
    const aspectRatio = this.canvasWidth / this.canvasHeight;
    const latCorrection = Math.cos((lat * Math.PI) / 180);
    const adjustedLonRange = latRange * aspectRatio;
    const x = ((lon - this.minLon) / adjustedLonRange) * this.canvasWidth * latCorrection;
    const y = ((this.maxLat - lat) / latRange) * this.canvasHeight;
    return { x, y };
  }

  canvasToLatLon(x: number, y: number): { lat: number; lon: number } {
    const latRange = this.maxLat - this.minLat;
    const aspectRatio = this.canvasWidth / this.canvasHeight;
    const lat = this.maxLat - (y / this.canvasHeight) * latRange;
    const latCorrection = Math.cos((lat * Math.PI) / 180);
    const adjustedLonRange = latRange * aspectRatio;
    const lon = this.minLon + (x / (this.canvasWidth * latCorrection)) * adjustedLonRange;
    return { lat, lon };
  }

  buildTrajectory(): void {
    if (!this.startPoint || !this.endPoint) {
      alert("Seleziona i punti di partenza e arrivo cliccando sulla mappa.");
      return;
    }

    // Calcola i cerchi e le tangenti iniziali
    this.simulateTrajectory();

    // Disegna archi e traiettoria completa
    this.drawTrajectory();
    this.buildGeoJSON();
  }

  createCircleBuffer(lat: number, lon: number, radiusKm: number): GeoJSON.Feature<GeoJSON.Polygon> | null {
    try {
      const center = turf.point([lon, lat]); // Create the center as a GeoJSON point
      // @ts-ignore
      const buffer = turf.buffer(center, radiusKm, { units: 'kilometers' }) as GeoJSON.Feature<GeoJSON.Polygon>;
      return buffer;
    } catch (error) {
      console.error('Error creating circle buffer:', error);
      return null;
    }
  }


  simulateTrajectory(): void {
    const path = [this.startPoint, ...this.waypoints, this.endPoint];
    this.circleTangents = [];

    path.forEach((point, index) => {
      // Crea il buffer per il cerchio
      // @ts-ignore
      const buffer = this.createCircleBuffer(point.lat, point.lon, point.height);

      if (buffer)
        this.drawCircle(buffer);

      const outgoingTangents: [Tangent | null, Tangent | null] = [null, null];

      if (index < path.length - 1) {
        const nextPoint = path[index + 1];
        const calculatedTangents = this.calculateTangents(
          // @ts-ignore
          [point.lon, point.lat, point.height],
          // @ts-ignore
          [nextPoint.lon, nextPoint.lat, nextPoint.height]
        );

        // Popola le tangenti outgoing
        outgoingTangents[0] = { start: calculatedTangents[0][0], end: calculatedTangents[0][1], truncated: false, tagliataSuOrigine: false, tagliataSuDestinazione: false };
        outgoingTangents[1] = { start: calculatedTangents[1][0], end: calculatedTangents[1][1], truncated: false,tagliataSuOrigine: false, tagliataSuDestinazione: false  };
      }

      this.circleTangents.push({
        circle: buffer!,
        outgoingTangents,
      });
    });

    this.truncateTangents();
  }
/*
  calculateTangents(
    start: [number, number, number], // [lon, lat, radius]
    end: [number, number, number] // [lon, lat, radius]
  ): [[number, number], [number, number]][] {
    const [lon1, lat1, r1] = start;
    const [lon2, lat2, r2] = end;

    const startPoint = turf.point([lon1, lat1]);
    const endPoint = turf.point([lon2, lat2]);

    const d = turf.distance(startPoint, endPoint, { units: "kilometers" } as any);

    if (d <= Math.abs(r1 - r2)) {
      return [];
    }

    const centerAngle = turf.bearing(startPoint, endPoint);
    const tangentAngle = Math.acos((r1 - r2) / d) * (180 / Math.PI);

    const tangent1Start = turf.destination(startPoint, r1, centerAngle + tangentAngle, { units: "kilometers" } as any);
    const tangent1End = turf.destination(endPoint, r2, centerAngle + tangentAngle, { units: "kilometers" } as any);

    const tangent2Start = turf.destination(startPoint, r1, centerAngle - tangentAngle, { units: "kilometers" } as any);
    const tangent2End = turf.destination(endPoint, r2, centerAngle - tangentAngle, { units: "kilometers" } as any);

    return [
      [tangent1Start.geometry.coordinates as [number, number], tangent1End.geometry.coordinates as [number, number]],
      [tangent2Start.geometry.coordinates as [number, number], tangent2End.geometry.coordinates as [number, number]],
    ];
  }
  */

  calculateTangents(
    start: [number, number, number], // [lon, lat, radius]
    end: [number, number, number] // [lon, lat, radius]
  ): [[number, number], [number, number]][] {
    const [lon1, lat1, r1] = start;
    const [lon2, lat2, r2] = end;

    const startPoint = turf.point([lon1, lat1]);
    const endPoint = turf.point([lon2, lat2]);

    const d = turf.distance(startPoint, endPoint, { units: "kilometers" } as any);

    if (d <= Math.abs(r1 - r2)) {
      return [];
    }

    const centerAngle = turf.bearing(startPoint, endPoint);
    const tangentAngle = Math.acos((r1 - r2) / d) * (180 / Math.PI);

    // Calcola tangenti con margine di estensione
    const margin = 0.001; // Margine aggiuntivo (in km)
    const tangent1Start = turf.destination(startPoint, r1 + margin, centerAngle + tangentAngle, { units: "kilometers" } as any);
    const tangent1End = turf.destination(endPoint, r2 + margin, centerAngle + tangentAngle, { units: "kilometers" } as any);

    const tangent2Start = turf.destination(startPoint, r1 + margin, centerAngle - tangentAngle, { units: "kilometers" } as any);
    const tangent2End = turf.destination(endPoint, r2 + margin, centerAngle - tangentAngle, { units: "kilometers" } as any);

    return [
      [tangent1Start.geometry.coordinates as [number, number], tangent1End.geometry.coordinates as [number, number]],
      [tangent2Start.geometry.coordinates as [number, number], tangent2End.geometry.coordinates as [number, number]],
    ];
  }

  /*
    truncateTangents(): void {
      this.circleTangents.forEach((current, index) => {
        if (index >= this.circleTangents.length - 1) return; // Salta l'ultimo cerchio (non ha tangenti in uscita)

        const next = this.circleTangents[index + 1];
        const currentTangents = current.outgoingTangents;
        const nextTangents = next.outgoingTangents;

        if (!currentTangents || !nextTangents) return;

        currentTangents.forEach((tangent, tangentIndex) => {
          if (!tangent) return;

          let closestIntersection: [number, number] | null = null;
          let minDistance = Infinity;

          nextTangents.forEach((nextTangent) => {
            if (!nextTangent) return;

            // Calcola l'intersezione tra le due tangenti
            const intersection = this.calculateLineIntersection(
              tangent.start,
              tangent.end,
              nextTangent.start,
              nextTangent.end
            );

            if (intersection) {
              const distance = this.calculateDistance(tangent.start, intersection);
              if (distance < minDistance) {
                closestIntersection = intersection;
                minDistance = distance;
              }
            }
          });

          if (closestIntersection) {
            // Tronca le tangenti
            currentTangents[tangentIndex] = {
              ...tangent,
              end: closestIntersection, // Troncatura dopo l'intersezione
              truncated: true,
              effettivamenteTagliato:true
            };

            const correspondingNextTangent = nextTangents[tangentIndex];
            if (correspondingNextTangent) {
              nextTangents[tangentIndex] = {
                ...correspondingNextTangent,
                start: closestIntersection, // Troncatura prima dell'intersezione
                truncated: true,
                effettivamenteTagliato:true
              };
            }
          } else {
            // Non c'è intersezione, impostiamo SOLO il flag `truncated` a `true`
            tangent.truncated = true;
          }
        });
      });
    }

  */

  truncateTangents(): void {
    this.circleTangents.forEach((current, index) => {
      if (index >= this.circleTangents.length - 1) return; // Salta l'ultimo cerchio (non ha tangenti in uscita)

      const next = this.circleTangents[index + 1];
      const currentTangents = current.outgoingTangents;
      const nextTangents = next.outgoingTangents;

      if (!currentTangents || !nextTangents) return;

      currentTangents.forEach((tangent, tangentIndex) => {
        if (!tangent) return;

        let closestIntersection: [number, number] | null = null;
        let minDistance = Infinity;

        nextTangents.forEach((nextTangent) => {
          if (!nextTangent) return;

          // Calcola l'intersezione tra le due tangenti
          const intersection = this.calculateLineIntersection(
            tangent.start,
            tangent.end,
            nextTangent.start,
            nextTangent.end
          );

          if (intersection) {
            const distance = this.calculateDistance(tangent.start, intersection);
            if (distance < minDistance) {
              closestIntersection = intersection;
              minDistance = distance;
            }
          }

          console.log("Calcolo intersezione:", {
            tangentStart: tangent.start,
            tangentEnd: tangent.end,
            nextTangentStart: nextTangent.start,
            nextTangentEnd: nextTangent.end,
            intersection,
          });
        });

        if (closestIntersection) {
          // Tronca le tangenti
          currentTangents[tangentIndex] = {
            ...tangent,
            end: closestIntersection, // Troncatura dopo l'intersezione
            truncated: true,
            tagliataSuDestinazione: true,
          };

          const correspondingNextTangent = nextTangents[tangentIndex];
          if (correspondingNextTangent) {
            nextTangents[tangentIndex] = {
              ...correspondingNextTangent,
              start: closestIntersection, // Troncatura prima dell'intersezione
              truncated: true,
              tagliataSuOrigine: true,
            };
          }
        } else {
          // Non c'è intersezione, impostiamo SOLO il flag `truncated` a `true`
          tangent.truncated = true;
          console.warn("Tangente non intersecata:", { index, tangentIndex, tangent });
        }
      });
    });

    // Controllo finale delle tangenti non troncate
    this.circleTangents.forEach((current, index) => {
      if (index < this.circleTangents.length - 1) { // Escludere l'ultimo punto
        const outgoingTangents = current.outgoingTangents || [];
        const nonTruncateTangents = outgoingTangents.filter(tangent => tangent && !tangent.tagliataSuOrigine && !tangent.tagliataSuDestinazione);
        if (nonTruncateTangents.length === outgoingTangents.length && outgoingTangents.length > 0) {
          console.warn("Punto con entrambe le tangenti non troncate:", { index, outgoingTangents });
        }
      }
    });
  }


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

    // Se il denominatore è zero, le linee sono parallele o coincidenti
    if (denominator === 0) {
      return null;
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denominator;

    // Verifica se il punto di intersezione si trova all'interno dei segmenti
    if (t < 0 || t > 1 || u < 0 || u > 1) {
      return null; // Nessuna intersezione nei segmenti
    }

    // Calcola il punto di intersezione
    const px = x1 + t * (x2 - x1);
    const py = y1 + t * (y2 - y1);

    return [px, py];
  }

  calculateDistance(point1: [number, number], point2: [number, number]): number {
    const [x1, y1] = point1;
    const [x2, y2] = point2;

    // Calcolo della distanza euclidea
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    return distance;
  }

  buildArcs(): void {
    this.circleTangents.forEach((current, index) => {
      const { circle, outgoingTangents } = current;

      if (!circle) return;

      const circleCoordinates = circle.geometry.coordinates[0] as [number, number][];
      /*
    // Caso del primo cerchio

          if (index === 0) {
            const touchingTangents = outgoingTangents.filter(tangent => tangent && tangent.truncated) as Tangent[];

            if (touchingTangents.length !== 2) {
              console.error("Errore: Non abbastanza tangenti valide per il primo cerchio.");
              return;
            }

            const [tangent1, tangent2] = touchingTangents;

            // Centro del secondo cerchio
            const secondCircleFeature = this.circleTangents[1]?.circle;
            if (!secondCircleFeature) {
              console.error("Errore: Il secondo cerchio non è definito.");
              return;
            }
            const secondCircleCenter = turf.center(turf.featureCollection([secondCircleFeature])).geometry.coordinates as [number, number];

            // Calcola gli indici dei punti sulla circonferenza
            const startIndex1 = this.findClosestIndex(circleCoordinates, tangent1.start);
            const startIndex2 = this.findClosestIndex(circleCoordinates, tangent2.start);

            const endIndex1 = this.findClosestIndex(circleCoordinates, tangent2.start);
            const endIndex2 = this.findClosestIndex(circleCoordinates, tangent1.start);

            // Ottieni i punti dell'arco in entrambe le direzioni
            const arc1 = this.getArcPoints(circleCoordinates, startIndex1, endIndex1, false);
            const arc2 = this.getArcPoints(circleCoordinates, startIndex2, endIndex2, false);

            // Calcola i "centri" dei due archi
            const arc1Center = this.calculateArcCenter(arc1);
            const arc2Center = this.calculateArcCenter(arc2);

            // Calcola le distanze dei centri degli archi rispetto al secondo cerchio
            const distanceToSecondCenter1 = this.calculateDistance(arc1Center, secondCircleCenter);
            const distanceToSecondCenter2 = this.calculateDistance(arc2Center, secondCircleCenter);

            console.log("Distanze tra i centri degli archi e il centro del secondo cerchio:", {
              arc1Center,
              distanceToSecondCenter1,
              arc2Center,
              distanceToSecondCenter2,
            });

            // Scegli l'arco più distante
            const selectedArc = distanceToSecondCenter1 > distanceToSecondCenter2 ? arc1 : arc2;

            if (selectedArc.length > 1) {
              this.savedArcs.push({ circleIndex: index, arcPoints: selectedArc });
            }

            // Disegna l'arco selezionato
            this.drawCircularArcWithColor(selectedArc, 'red');
          }

    */
      // Caso del primo cerchio
      if (index === 0) {
        const touchingTangents = outgoingTangents.filter(tangent => tangent && tangent.truncated) as Tangent[];

        if (touchingTangents.length !== 2) {
          console.error("Errore: Non abbastanza tangenti valide per il primo cerchio.");
          return;
        }

        const [tangent1, tangent2] = touchingTangents;

        // Centro del secondo cerchio
        const secondCircleFeature = this.circleTangents[1]?.circle;
        if (!secondCircleFeature) {
          console.error("Errore: Il secondo cerchio non è definito.");
          return;
        }
        const secondCircleCenter = turf.center(turf.featureCollection([secondCircleFeature])).geometry.coordinates as [number, number];

        // Calcola gli indici dei punti sulla circonferenza
        let startIndex1 = this.findClosestIndex(circleCoordinates, tangent1.start);
        let startIndex2 = this.findClosestIndex(circleCoordinates, tangent2.start);

        let endIndex1 = this.findClosestIndex(circleCoordinates, tangent2.start);
        let endIndex2 = this.findClosestIndex(circleCoordinates, tangent1.start);

        // Estendi leggermente gli indici per rendere gli archi più lunghi
        const extension = 0; // Numero di punti da estendere (ad esempio, 3)
        startIndex1 = (startIndex1 - extension + circleCoordinates.length) % circleCoordinates.length;
        startIndex2 = (startIndex2 - extension + circleCoordinates.length) % circleCoordinates.length;
        endIndex1 = (endIndex1 + extension) % circleCoordinates.length;
        endIndex2 = (endIndex2 + extension) % circleCoordinates.length;

        // Ottieni i punti dell'arco in entrambe le direzioni
        const arc1 = this.getArcPoints(circleCoordinates, startIndex1, endIndex1, false);
        const arc2 = this.getArcPoints(circleCoordinates, startIndex2, endIndex2, false);

        this.drawPointDiTangenza(tangent1.start, 'black');
        this.drawPointDiTangenza(tangent2.start, 'black');

        // Calcola i "centri" dei due archi
        const arc1Center = this.calculateArcCenter(arc1);
        const arc2Center = this.calculateArcCenter(arc2);

        // Calcola le distanze dei centri degli archi rispetto al secondo cerchio
        const distanceToSecondCenter1 = this.calculateDistance(arc1Center, secondCircleCenter);
        const distanceToSecondCenter2 = this.calculateDistance(arc2Center, secondCircleCenter);

        console.log("Distanze tra i centri degli archi e il centro del secondo cerchio:", {
          arc1Center,
          distanceToSecondCenter1,
          arc2Center,
          distanceToSecondCenter2,
        });

        // Scegli l'arco più distante
        let selectedArc = distanceToSecondCenter1 > distanceToSecondCenter2 ? arc1 : arc2;

        const circleCenter = turf.center(turf.featureCollection([this.circleTangents[index].circle])).geometry.coordinates as [number, number];
        const circleDiameter = turf.distance(
          turf.point(circleCenter),
          turf.point(this.circleTangents[index].circle.geometry.coordinates[0][0]),
          { units: "kilometers" } as any
        ) * 2;

        //selectedArc = this.polishArc(selectedArc, circleCenter, circleDiameter)

        if (selectedArc.length > 1) {
          this.savedArcs.push({ circleIndex: index, arcPoints: selectedArc });
        }

        // Disegna l'arco selezionato
        this.drawCircularArcWithColor(selectedArc, 'red');
      }

/* IMPLEMENTAZIONE PER PRENDERE SEMPRE IL CERCHIO PIU BREVE - NON è SEMPRE LA SCELTA GIUSTA
// Caso dei cerchi intermedi
      else if (index > 0 && index < this.circleTangents.length - 1) {
        const prevOutgoingTangents = this.circleTangents[index - 1]?.outgoingTangents;
        const currentTouchingTangents = outgoingTangents.filter(tangent => tangent && tangent.truncated) as Tangent[];

        if (!prevOutgoingTangents || currentTouchingTangents.length !== 2) {
          console.error("Errore: Non abbastanza tangenti valide per il cerchio intermedio.");
          return;
        }

        const prevPoints = prevOutgoingTangents
          .filter(tangent => tangent && !tangent.tagliataSuDestinazione)
          .map(t => t!.end);

        const currentPoints = currentTouchingTangents
          .filter(tangent => !tangent.tagliataSuOrigine)
          .map(t => t.start);

        if (prevPoints.length !== 1 || currentPoints.length !== 1) {
          console.error("Errore: I punti effettivamente non tagliati non sono esattamente uno per ciascun cerchio.");
          return;
        }

        // Crea l'arco tra i due insiemi di punti
        prevPoints.forEach(prevPoint => {
          currentPoints.forEach(currentPoint => {
            this.processArc(circleCoordinates, prevPoint, currentPoint, 'orange', index);
          });
        });
      }
      */
      // Caso dei cerchi intermedi
      else if (index > 0 && index < this.circleTangents.length - 1) {
        const prevOutgoingTangents = this.circleTangents[index - 1]?.outgoingTangents;
        const currentTouchingTangents = outgoingTangents.filter(tangent => tangent && tangent.truncated) as Tangent[];

        if (!prevOutgoingTangents || currentTouchingTangents.length !== 2) {
          console.error("Errore: Non abbastanza tangenti valide per il cerchio intermedio.");
          return;
        }

        const prevPoints = prevOutgoingTangents
          .filter(tangent => tangent && !tangent.tagliataSuDestinazione)
          .map(t => t!.end);

        const currentPoints = currentTouchingTangents
          .filter(tangent => tangent && !tangent.tagliataSuOrigine)
          .map(t => t!.start);

        if (prevPoints.length !== 1 || currentPoints.length !== 1) {
          console.error("Errore: I punti effettivamente non tagliati non sono esattamente due per ciascun cerchio.");
          return;
        }

        // Centro del cerchio precedente
        const prevCircleCenter = turf.center(turf.featureCollection([this.circleTangents[index - 1].circle])).geometry.coordinates as [number, number];

        // Calcola gli indici dei punti sulla circonferenza
        let startIndex1 = this.findClosestIndexWithTolerance(circleCoordinates, prevPoints[0],Infinity);
        let endIndex1 = this.findClosestIndexWithTolerance(circleCoordinates, currentPoints[0],Infinity);

        // EstendE indici per rendere gli archi più lunghi
        const extension = 0;
        startIndex1 = (startIndex1 - extension + circleCoordinates.length) % circleCoordinates.length;
        endIndex1 = (endIndex1 + extension) % circleCoordinates.length;

        this.drawPointDiTangenza(prevPoints[0], 'black');
        this.drawPointDiTangenza(currentPoints[0], 'black');

        // Ottieni i punti degli archi in entrambe le direzioni
        const arc1 = this.getArcPoints(circleCoordinates, startIndex1, endIndex1, false);
        const arc2 = this.getArcPoints(circleCoordinates, endIndex1, startIndex1, false);

        // Calcola i "centri" dei due archi
        const arc1Center = this.calculateArcCenter(arc1);
        const arc2Center = this.calculateArcCenter(arc2);

        // Calcola le distanze dei centri degli archi rispetto al cerchio precedente
        const distanceToPrevCenter1 = this.calculateDistance(arc1Center, prevCircleCenter);
        const distanceToPrevCenter2 = this.calculateDistance(arc2Center, prevCircleCenter);

        console.log("Distanze tra i centri degli archi e il centro del cerchio precedente:", {
          arc1Center,
          distanceToPrevCenter1,
          arc2Center,
          distanceToPrevCenter2,
        });

        const arc1Length = this.calculateArcLength(arc1);
        const arc2Length = this.calculateArcLength(arc2);
        const maxArcLength = circleCoordinates.length * 0.8; // Lunghezza massima consentita per l'arco
        const arc1IsValid = distanceToPrevCenter1 > distanceToPrevCenter2 && arc1Length <= maxArcLength;
        const arc2IsValid = distanceToPrevCenter2 > distanceToPrevCenter1 && arc2Length <= maxArcLength;
        let selectedArc: [number, number][];

        if (arc1IsValid) {
          selectedArc = arc1;
        } else if (arc2IsValid) {
          selectedArc = arc2;
        } else {
          // Se nessuno soddisfa entrambe le condizioni, scegli l'arco con il centro più distante
          selectedArc = distanceToPrevCenter1 > distanceToPrevCenter2 ? arc1 : arc2;
        }


        const circleCenter = turf.center(turf.featureCollection([this.circleTangents[index].circle])).geometry.coordinates as [number, number];
        const circleDiameter = turf.distance(
          turf.point(circleCenter),
          turf.point(this.circleTangents[index].circle.geometry.coordinates[0][0]),
          { units: "kilometers" } as any
        ) * 2;

       // selectedArc = this.polishArc(selectedArc, circleCenter, circleDiameter)




        if (selectedArc.length > 1) {
          this.savedArcs.push({ circleIndex: index, arcPoints: selectedArc });
        }

        this.drawCircularArcWithColor(selectedArc, 'orange');
      }

        /*
        // Caso dell'ultimo cerchio
              else if (index === this.circleTangents.length - 1) {
                const prevOutgoingTangents = this.circleTangents[index - 1]?.outgoingTangents;

                if (!prevOutgoingTangents) {
                  console.error("Errore: Non abbastanza tangenti valide per l'ultimo cerchio.");
                  return;
                }

                // Filtra i punti `end` delle tangenti del cerchio precedente
                const prevPoints = prevOutgoingTangents.filter(tangent => tangent && tangent.truncated).map(t => t!.end);

                if (prevPoints.length !== 2) {
                  console.error("Errore: Non abbastanza punti di tangenza per l'ultimo cerchio.");
                  return;
                }

                const [tangentPoint1, tangentPoint2] = prevPoints;

                // Centro del cerchio N-1
                const penultimateCircleFeature = this.circleTangents[index - 1]?.circle;
                if (!penultimateCircleFeature) {
                  console.error("Errore: Il cerchio N-1 non è definito.");
                  return;
                }
                const penultimateCircleCenter = turf.center(turf.featureCollection([penultimateCircleFeature])).geometry.coordinates as [number, number];

                // Calcola gli indici dei punti sulla circonferenza
                const startIndex1 = this.findClosestIndex(circleCoordinates, tangentPoint1);
                const startIndex2 = this.findClosestIndex(circleCoordinates, tangentPoint2);

                const endIndex1 = this.findClosestIndex(circleCoordinates, tangentPoint2);
                const endIndex2 = this.findClosestIndex(circleCoordinates, tangentPoint1);

                // Ottieni i punti degli archi in entrambe le direzioni
                const arc1 = this.getArcPoints(circleCoordinates, startIndex1, endIndex1, false);
                const arc2 = this.getArcPoints(circleCoordinates, startIndex2, endIndex2, false);

                // Calcola i "centri" dei due archi
                const arc1Center = this.calculateArcCenter(arc1);
                const arc2Center = this.calculateArcCenter(arc2);

                // Calcola le distanze dei centri degli archi rispetto al penultimo cerchio
                const distanceToPenultimateCenter1 = this.calculateDistance(arc1Center, penultimateCircleCenter);
                const distanceToPenultimateCenter2 = this.calculateDistance(arc2Center, penultimateCircleCenter);

                console.log("Distanze tra i centri degli archi e il centro del cerchio N-1:", {
                  arc1Center,
                  distanceToPenultimateCenter1,
                  arc2Center,
                  distanceToPenultimateCenter2,
                });

                // Scegli l'arco più lontano dal penultimo cerchio
                const selectedArc = distanceToPenultimateCenter1 > distanceToPenultimateCenter2 ? arc1 : arc2;

                if (selectedArc.length > 1) {
                  this.savedArcs.push({ circleIndex: index, arcPoints: selectedArc });
                }

                // Disegna l'arco selezionato
                this.drawCircularArcWithColor(selectedArc, 'green');
              }
        */
      // Caso dell'ultimo cerchio
      else if (index === this.circleTangents.length - 1) {
        const prevOutgoingTangents = this.circleTangents[index - 1]?.outgoingTangents;

        if (!prevOutgoingTangents) {
          console.error("Errore: Non abbastanza tangenti valide per l'ultimo cerchio.");
          return;
        }

        // Filtra i punti `end` delle tangenti del cerchio precedente
        const prevPoints = prevOutgoingTangents.filter(tangent => tangent && tangent.truncated).map(t => t!.end);

        if (prevPoints.length !== 2) {
          console.error("Errore: Non abbastanza punti di tangenza per l'ultimo cerchio.");
          return;
        }

        const [tangentPoint1, tangentPoint2] = prevPoints;

        // Centro del cerchio N-1
        const penultimateCircleFeature = this.circleTangents[index - 1]?.circle;
        if (!penultimateCircleFeature) {
          console.error("Errore: Il cerchio N-1 non è definito.");
          return;
        }
        const penultimateCircleCenter = turf.center(turf.featureCollection([penultimateCircleFeature])).geometry.coordinates as [number, number];

        // Calcola gli indici dei punti sulla circonferenza
        let startIndex1 = this.findClosestIndex(circleCoordinates, tangentPoint1);
        let startIndex2 = this.findClosestIndex(circleCoordinates, tangentPoint2);

        let endIndex1 = this.findClosestIndex(circleCoordinates, tangentPoint2);
        let endIndex2 = this.findClosestIndex(circleCoordinates, tangentPoint1);

        this.drawPointDiTangenza(tangentPoint1, 'black');
        this.drawPointDiTangenza(tangentPoint2, 'black');

        // Estendi leggermente gli indici per rendere gli archi più lunghi
        const extension = -0.2; // Numero di punti da estendere
        startIndex1 = (startIndex1 - extension + circleCoordinates.length) % circleCoordinates.length;
        startIndex2 = (startIndex2 - extension + circleCoordinates.length) % circleCoordinates.length;
        endIndex1 = (endIndex1 + extension) % circleCoordinates.length;
        endIndex2 = (endIndex2 + extension) % circleCoordinates.length;

        // Ottieni i punti degli archi in entrambe le direzioni
        const arc1 = this.getArcPoints(circleCoordinates, startIndex1, endIndex1, false);
        const arc2 = this.getArcPoints(circleCoordinates, startIndex2, endIndex2, false);

        // Calcola i "centri" dei due archi
        const arc1Center = this.calculateArcCenter(arc1);
        const arc2Center = this.calculateArcCenter(arc2);

        // Calcola le distanze dei centri degli archi rispetto al penultimo cerchio
        const distanceToPenultimateCenter1 = this.calculateDistance(arc1Center, penultimateCircleCenter);
        const distanceToPenultimateCenter2 = this.calculateDistance(arc2Center, penultimateCircleCenter);

        console.log("Distanze tra i centri degli archi e il centro del cerchio N-1:", {
          arc1Center,
          distanceToPenultimateCenter1,
          arc2Center,
          distanceToPenultimateCenter2,
        });

        // Scegli l'arco più lontano dal penultimo cerchio
        let selectedArc = distanceToPenultimateCenter1 > distanceToPenultimateCenter2 ? arc1 : arc2;

        const circleCenter = turf.center(turf.featureCollection([this.circleTangents[index].circle])).geometry.coordinates as [number, number];
        const circleDiameter = turf.distance(
          turf.point(circleCenter),
          turf.point(this.circleTangents[index].circle.geometry.coordinates[0][0]),
          { units: "kilometers" } as any
        ) * 2;

      //  selectedArc = this.polishArc(selectedArc, circleCenter, circleDiameter)



        if (selectedArc.length > 1) {
          this.savedArcs.push({ circleIndex: index, arcPoints: selectedArc });
        }

        // Disegna l'arco selezionato
        this.drawCircularArcWithColor(selectedArc, 'green');
      }


    });
  }


  calculateArcCenter(arcPoints: [number, number][]): [number, number] {
    const totalPoints = arcPoints.length;
    if (totalPoints === 0) {
      throw new Error("Errore: Arco vuoto, impossibile calcolare il centro.");
    }

    const midpointIndex = Math.floor(totalPoints / 2);
    return arcPoints[midpointIndex];
  }

/*
  processArc(
    circleCoordinates: [number, number][],
    tangentPoint1: [number, number],
    tangentPoint2: [number, number],
    color: string,
    index: number
  ): void {

    this.drawPointDiTangenza(tangentPoint1, 'black');
    this.drawPointDiTangenza(tangentPoint2, 'black');

    // Ottieni i punti dell'arco tra i due punti di tangenza
    const arcPoints = this.getArcPointsBetweenTangents(circleCoordinates, tangentPoint1, tangentPoint2);

    if (arcPoints.length > 1) {
      this.savedArcs.push({ circleIndex: index, arcPoints: arcPoints });
    }

    // Disegna l'arco sulla mappa
    this.drawCircularArcWithColor(arcPoints, color);
  }
*/
  drawPointDiTangenza(point: [number, number], color: string = 'black', radius: number = 5): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error("Errore: impossibile ottenere il contesto del canvas.");
      return;
    }

    const { x, y } = this.latLonToCanvas(point[1], point[0]); // Converti da [lon, lat] a coordinate canvas
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI); // Disegna un cerchio con il raggio specificato
    ctx.fill();
    ctx.lineWidth = 2; // Contorno
    ctx.strokeStyle = 'white'; // Contorno bianco per evidenziarli
    ctx.stroke();
  }

  processArc(
    circleCoordinates: [number, number][],
    tangentPoint1: [number, number],
    tangentPoint2: [number, number],
    color: string,
    index: number
  ): void {
    this.drawPointDiTangenza(tangentPoint1, 'black');
    this.drawPointDiTangenza(tangentPoint2, 'black');

    // Estendi i punti di tangenza per garantire che siano all'interno del cerchio
    const margin = 0.03; // Estensione per eccesso
    const extendedTangentPoint1 = this.extendPointTowardsCenter(circleCoordinates, tangentPoint1, margin);
    const extendedTangentPoint2 = this.extendPointTowardsCenter(circleCoordinates, tangentPoint2, margin);

    // Ottieni i punti dell'arco tra i due punti di tangenza
    const arcPoints = this.getArcPointsBetweenTangents(circleCoordinates, extendedTangentPoint1, extendedTangentPoint2);

    if (arcPoints.length > 1) {
      this.savedArcs.push({ circleIndex: index, arcPoints: arcPoints });
    }

    // Disegna l'arco sulla mappa
    this.drawCircularArcWithColor(arcPoints, color);
  }

  extendPointTowardsCenter(
    circleCoordinates: [number, number][],
    point: [number, number],
    margin: number
  ): [number, number] {
    const center = this.calculateCircleCenter(circleCoordinates);
    const vector = [point[0] - center[0], point[1] - center[1]];
    const length = Math.sqrt(vector[0] ** 2 + vector[1] ** 2);
    const scale = (length + margin) / length;
    return [center[0] + vector[0] * scale, center[1] + vector[1] * scale];
  }

  calculateCircleCenter(circleCoordinates: [number, number][]): [number, number] {
    const sum = circleCoordinates.reduce(
      (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
      [0, 0]
    );
    return [sum[0] / circleCoordinates.length, sum[1] / circleCoordinates.length];
  }


  /**
   * Trova l'indice del punto sulla circonferenza più vicino a un punto target.
   * @param circleCoordinates - Le coordinate della circonferenza.
   * @param target - Il punto di destinazione [lon, lat].
   * @returns L'indice del punto più vicino o -1 se nessun punto rientra nella tolleranza.
   */
  findClosestIndex(circleCoordinates: [number, number][], target: [number, number]): number {
    let closestIndex = -1;
    let minDistance = Infinity;
    const tolerance =  0.10; // Usa la tolleranza dichiarata

    circleCoordinates.forEach(([x, y], index) => {
      const distance = Math.sqrt(Math.pow(x - target[0], 2) + Math.pow(y - target[1], 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    if (minDistance > tolerance) {
      console.warn(`Punto non trovato entro la tolleranza: Min Distance = ${minDistance}`);
      return -1;
    }

    return closestIndex;
  }


  findClosestIndexWithTolerance(
    circleCoordinates: [number, number][],
    target: [number, number],
    tolerance: number = 0.001 // Default: tolleranza per trovare il punto più vicino
  ): number {
    let closestIndex = -1;
    let minDistance = Infinity;

    circleCoordinates.forEach(([x, y], index) => {
      const distance = Math.sqrt(Math.pow(x - target[0], 2) + Math.pow(y - target[1], 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // Se la distanza minima è maggiore della tolleranza, ritorna -1
    if (minDistance > tolerance) {
      console.warn(`Nessun punto trovato entro la tolleranza. Min Distance: ${minDistance}`);
      return -1;
    }

    return closestIndex;
  }


  /**
   * Disegna un arco sul canvas con un colore specificato.
   * @param arcPoints - Array di punti che definiscono l'arco (coordinate [lon, lat]).
   * @param color - Colore dell'arco.
   */
  drawCircularArcWithColor(arcPoints: [number, number][], color: string): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error("Errore: impossibile ottenere il contesto del canvas.");
      return;
    }

    // Inizia il disegno dell'arco
    ctx.beginPath();
    arcPoints.forEach(([lon, lat], index) => {
      const { x, y } = this.latLonToCanvas(lat, lon); // Converti le coordinate geografiche in coordinate canvas
      if (index === 0) {
        ctx.moveTo(x, y); // Inizio dell'arco
      } else {
        ctx.lineTo(x, y); // Linea fino al punto successivo
      }
    });

    // Imposta il colore e disegna l'arco
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }



  /**
   * Ottiene i punti dell'arco in base alla direzione.
   */
  getArcPoints(
    circleCoordinates: [number, number][],
    startIndex: number,
    endIndex: number,
    isBelow: boolean
  ): [number, number][] {
    if (isBelow) {
      if (startIndex <= endIndex) {
        // Movimento in senso orario
        return circleCoordinates.slice(startIndex, endIndex + 1);
      } else {
        // Attraversa il bordo della lista
        return [
          ...circleCoordinates.slice(startIndex),
          ...circleCoordinates.slice(0, endIndex + 1),
        ];
      }
    } else {
      if (endIndex <= startIndex) {
        // Movimento in senso antiorario
        return circleCoordinates.slice(endIndex, startIndex + 1).reverse();
      } else {
        // Attraversa il bordo della lista
        return [
          ...circleCoordinates.slice(endIndex).reverse(),
          ...circleCoordinates.slice(0, startIndex + 1).reverse(),
        ];
      }
    }
  }
/*
  getArcPointsBetweenTangents(
    circleCoordinates: [number, number][],
    tangentPoint1: [number, number],
    tangentPoint2: [number, number]
  ): [number, number][] {
    const startIndex = this.findClosestIndex(circleCoordinates, tangentPoint1);
    const endIndex = this.findClosestIndex(circleCoordinates, tangentPoint2);

    if (startIndex === -1 || endIndex === -1) {
      console.error("Errore: impossibile trovare gli indici sulla circonferenza.", {
        tangentPoint1,
        tangentPoint2,
        circleCoordinates,
      });
      return [];
    }

    // Ottieni i punti degli archi in entrambe le direzioni
    const clockwiseArc = this.getArcPoints(circleCoordinates, startIndex, endIndex, false);
    const counterClockwiseArc = this.getArcPoints(circleCoordinates, startIndex, endIndex, true);

    // Confronta le lunghezze degli archi per selezionare quello più breve
    const clockwiseLength = this.calculateArcLength(clockwiseArc);
    const counterClockwiseLength = this.calculateArcLength(counterClockwiseArc);

    return clockwiseLength < counterClockwiseLength ? clockwiseArc : counterClockwiseArc;
  }
*/

  getArcPointsBetweenTangents(
    circleCoordinates: [number, number][],
    tangentPoint1: [number, number],
    tangentPoint2: [number, number]
  ): [number, number][] {
    const tolerance = -2; // Tolleranza per accettare un punto vicino invece di uno esatto

    let startIndex = this.findClosestIndex(circleCoordinates, tangentPoint1);
    let endIndex = this.findClosestIndex(circleCoordinates, tangentPoint2);

    if (startIndex === -1 || endIndex === -1) {
      console.warn("Punti di tangenza fuori tolleranza. Cerchiamo il punto più vicino disponibile.", {
        tangentPoint1,
        tangentPoint2,
        circleCoordinates,
      });

      // Usa i punti più vicini alla tolleranza come fallback
      startIndex = this.findClosestIndexWithTolerance(circleCoordinates, tangentPoint1, Infinity);
      endIndex = this.findClosestIndexWithTolerance(circleCoordinates, tangentPoint2, Infinity);
    }

    if (startIndex === -1 || endIndex === -1) {
      console.error("Errore: impossibile trovare punti vicini accettabili sulla circonferenza.", {
        tangentPoint1,
        tangentPoint2,
        circleCoordinates,
      });
      return [];
    }

    // Ottieni i punti degli archi in entrambe le direzioni
    const clockwiseArc = this.getArcPoints(circleCoordinates, startIndex, endIndex, false);
    const counterClockwiseArc = this.getArcPoints(circleCoordinates, startIndex, endIndex, true);

    // Confronta le lunghezze degli archi per selezionare quello più breve
    const clockwiseLength = this.calculateArcLength(clockwiseArc);
    const counterClockwiseLength = this.calculateArcLength(counterClockwiseArc);

    return clockwiseLength < counterClockwiseLength ? clockwiseArc : counterClockwiseArc;
  }


  calculateArcLength(arcPoints: [number, number][]): number {
    let length = 0;

    for (let i = 1; i < arcPoints.length; i++) {
      const [lon1, lat1] = arcPoints[i - 1];
      const [lon2, lat2] = arcPoints[i];
      length += turf.distance(turf.point([lon1, lat1]), turf.point([lon2, lat2]), { units: "kilometers" } as any);
    }

    return length;
  }

  drawTrajectory(): void {
    this.buildArcs();
    this.circleTangents.forEach((circleData) => {
      if (circleData.outgoingTangents) {
        circleData.outgoingTangents.forEach((tangent) => {
          if (tangent) {
            this.drawTangents([[tangent.start, tangent.end]]);
          }
        });
      }
    });
  }

  /**
   * Disegna una o più tangenti sul canvas.
   * @param tangents - Array di coppie di coordinate che rappresentano le tangenti [[start, end], ...].
   * @param color - Colore della tangente (opzionale, default: 'blue').
   */
  drawTangents(tangents: [[number, number], [number, number]][], color: string = 'blue'): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error("Errore: impossibile ottenere il contesto del canvas.");
      return;
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;

    tangents.forEach(([start, end]) => {
      const { x: x1, y: y1 } = this.latLonToCanvas(start[1], start[0]); // Converti il punto di partenza
      const { x: x2, y: y2 } = this.latLonToCanvas(end[1], end[0]);   // Converti il punto di arrivo

      ctx.beginPath();
      ctx.moveTo(x1, y1); // Inizia dal punto di partenza
      ctx.lineTo(x2, y2); // Disegna fino al punto di arrivo
      ctx.stroke();
    });
  }

  drawCircle(circle: GeoJSON.Feature<GeoJSON.Polygon>, color: string = 'rgba(173, 216, 230, 0.5)'): void {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error("Errore: impossibile ottenere il contesto del canvas.");
      return;
    }

    const coordinates = circle.geometry.coordinates[0] as [number, number][];
    if (!coordinates || coordinates.length === 0) {
      console.error("Errore: coordinate del cerchio non valide.");
      return;
    }

    ctx.beginPath();
    coordinates.forEach(([lon, lat], index) => {
      const { x, y } = this.latLonToCanvas(lat, lon);
      if (index === 0) {
        ctx.moveTo(x, y); // Inizia dal primo punto
      } else {
        ctx.lineTo(x, y); // Traccia fino al punto successivo
      }
    });

    ctx.closePath();
    ctx.fillStyle = color; // Colore blu chiaro
    ctx.fill();
    ctx.lineWidth = 1; // Contorno leggero
    ctx.strokeStyle = 'blue'; // Contorno blu
    ctx.stroke();
  }

  polishArc(
    arcPoints: [number, number][],
    circleCenter: [number, number],
    circleDiameter: number,
    margin: number = 0.05 // Percentuale del diametro da considerare come margine
  ): [number, number][] {
    const threshold = (circleDiameter / 2) - margin; // Raggio meno un piccolo margine

    // Filtra i punti che sono più distanti del threshold dal centro del cerchio
    return arcPoints.filter(point => {
      const distance = this.calculateDistance(point, circleCenter);
      return distance >= threshold;
    });
  }


  buildGeoJSON(): void {
    const features: GeoJSON.Feature[] = [];

    // Aggiungi tutte le tangenti troncate
    this.circleTangents.forEach((current, index) => {
      const outgoingTangents = current.outgoingTangents;

      if (outgoingTangents) {
        outgoingTangents.forEach((tangent, tangentIndex) => {
          if (tangent && tangent.truncated) {
            const tangentFeature: GeoJSON.Feature<GeoJSON.LineString> = {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [tangent.start, tangent.end],
              },
              properties: {
                type: 'tangent',
                index: `${index}-${tangentIndex}`,
                truncated: tangent.truncated,
                tagliataSuOrigine: tangent.tagliataSuOrigine,
                tagliataSuDestinazione: tangent.tagliataSuDestinazione,
              },
            };
            features.push(tangentFeature);
          }
        });
      }
    });

    // Aggiungi tutti gli archi salvati
    this.savedArcs.forEach(({ circleIndex, arcPoints }) => {
      const arcFeature: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: arcPoints,
        },
        properties: {
          type: 'arc',
          circleIndex,
        },
      };
      features.push(arcFeature);
    });

    // Creare il GeoJSON finale
    const finalGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: features,
    };

    console.log(JSON.stringify(finalGeoJSON, null, 2));
  }


/*
  buildGeoJSONSmoothed(): void {
    const features: GeoJSON.Feature[] = [];

    // Aggiungi tutte le tangenti troncate
    this.circleTangents.forEach((current, index) => {
      const outgoingTangents = current.outgoingTangents;

      if (outgoingTangents) {
        outgoingTangents.forEach((tangent, tangentIndex) => {
          if (tangent && tangent.truncated) {
            const tangentFeature: GeoJSON.Feature<GeoJSON.LineString> = {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [tangent.start, tangent.end],
              },
              properties: {
                type: 'tangent',
                index: `${index}-${tangentIndex}`,
                truncated: tangent.truncated,
                effettivamenteTagliato: tangent.effettivamenteTagliato,
              },
            };
            features.push(tangentFeature);
          }
        });
      }
    });

    // Aggiungi tutti gli archi salvati
    this.savedArcs.forEach(({ circleIndex, arcPoints }) => {
      const arcFeature: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: arcPoints,
        },
        properties: {
          type: 'arc',
          circleIndex,
        },
      };
      features.push(arcFeature);
    });

    // Creare il GeoJSON iniziale
    const geoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: features,
    };

    // Connetti i punti vicini separati
    const allPoints: [number, number][] = [];

    // Estrai tutti i punti da tangenti e archi
    geoJSON.features.forEach((feature) => {
      if (feature.geometry.type === 'LineString') {
        const coordinates = feature.geometry.coordinates as [number, number][];
        allPoints.push(...coordinates);
      }
    });

    // Mantieni solo punti unici
    const uniquePoints = [...new Set(allPoints.map((point) => JSON.stringify(point)))].map((point) =>
      JSON.parse(point)
    );

    const connections: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    const connected = new Set<string>();

    uniquePoints.forEach((point) => {
      const pointKey = JSON.stringify(point);

      if (!connected.has(pointKey)) {
        let nearestPoint: [number, number] | null = null;
        let minDistance = Infinity;

        uniquePoints.forEach((otherPoint) => {
          if (JSON.stringify(otherPoint) !== pointKey) {
            const distance = this.calculateDistanceGeo(point, otherPoint);

            if (distance < minDistance) {
              minDistance = distance;
              nearestPoint = otherPoint;
            }
          }
        });

        if (nearestPoint) {
          // Connetti al punto più vicino
          connections.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [point, nearestPoint],
            },
            properties: {
              type: 'connection',
              distance: minDistance,
            },
          });

          connected.add(pointKey);
          connected.add(JSON.stringify(nearestPoint));
        }
      }
    });

    // Aggiungi le connessioni al GeoJSON originale
    geoJSON.features.push(...connections);

    // Stampa il GeoJSON finale
    console.log(JSON.stringify(geoJSON, null, 2));
  }

  calculateDistanceGeo(point1: [number, number], point2: [number, number]): number {
    const [x1, y1] = point1;
    const [x2, y2] = point2;

    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
*/
}
