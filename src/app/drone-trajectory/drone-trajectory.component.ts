import { Component, OnInit } from '@angular/core';
import * as turf from '@turf/turf';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-drone-trajectory',
  templateUrl: './drone-trajectory.component.html',
  imports: [FormsModule, CommonModule],
  styleUrls: ['./drone-trajectory.component.css']
})
export class DroneTrajectoryComponent implements OnInit {
  protected canvasWidth: number = 1200; // Larghezza della mappa
  protected canvasHeight: number = 800; // Altezza della mappa
  protected startPoint: { x: number; y: number; height: number } | null = null;
  protected endPoint: { x: number; y: number; height: number } | null = null;
  protected waypoints: { x: number; y: number; height: number }[] = []; // Punti intermedi
  protected dronePosition: { x: number; y: number } | null = null;

  startHeight: number = 1; // Altezza iniziale in km
  endHeight: number = 0.5; // Altezza finale in km

  ngOnInit(): void {}

  onMapClick(event: MouseEvent): void {
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();

    // Calcola le coordinate relative al canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (!this.startPoint) {
      // Punto di partenza
      this.startPoint = { x, y, height: this.startHeight };
    } else if (!this.endPoint) {
      // Punto di arrivo
      this.endPoint = { x, y, height: this.endHeight };
    } else {
      // Aggiungi punto intermedio con altezza iniziale
      const height = prompt('Inserisci l\'altezza (km) per questo punto:', '1');
      if (height !== null) {
        this.waypoints.push({ x, y, height: parseFloat(height) });
      }
    }
  }

  simulateDroneMovement(): void {
    if (!this.startPoint || !this.endPoint) {
      alert('Seleziona prima i punti di partenza e arrivo cliccando sulla mappa.');
      return;
    }

    // Crea un percorso combinato: [startPoint, waypoints..., endPoint]
    const path = [this.startPoint, ...this.waypoints, this.endPoint];
    const totalSteps = 200; // Numero totale di passi tra tutti i punti
    const stepsPerSegment = Math.floor(totalSteps / (path.length - 1)); // Passi per segmento

    let step = 0;
    let currentSegment = 0;

    const interval = setInterval(() => {
      if (currentSegment >= path.length - 1) {
        clearInterval(interval); // Ferma il movimento quando il drone raggiunge l'ultimo punto
        this.dronePosition = { ...path[path.length - 1] }; // Imposta il drone sul punto di arrivo

        // Disegna il cerchio finale
        this.drawImpactArea(
          this.endPoint!.x,
          this.endPoint!.y,
          this.endPoint!.height
        );

        setTimeout(() => alert('Drone arrivato al punto di arrivo!'), 500); // Messaggio di completamento
        return;
      }

      const start = path[currentSegment];
      const end = path[currentSegment + 1];

      const dx = (end.x - start.x) / stepsPerSegment;
      const dy = (end.y - start.y) / stepsPerSegment;
      const dz = (end.height - start.height) / stepsPerSegment;

      // Calcola la posizione corrente del drone
      const x = start.x + dx * (step % stepsPerSegment);
      const y = start.y + dy * (step % stepsPerSegment);
      const height = start.height + dz * (step % stepsPerSegment);

      this.dronePosition = { x, y };

      // Usa Turf.js per calcolare il buffer
      this.drawImpactArea(x, y, height);

      step++;

      // Cambia segmento al termine di un percorso
      if (step % stepsPerSegment === 0) {
        currentSegment++;
      }
    }, 110); // Movimento più lento con un intervallo di 110ms
  }

  drawImpactArea(x: number, y: number, height: number): void {
    // Calcola il raggio del buffer (50px per km di altezza)
    const bufferRadius = height * 50; // Raggio proporzionato alla scala

    // Usa Turf.js per creare un punto e un buffer
    const point = turf.point([x, y]);
    const buffered = turf.buffer(point, bufferRadius / this.canvasWidth, {
      units: 'kilometers',
    });

    // Disegna il buffer sul canvas
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.beginPath();
    ctx.arc(x, y, bufferRadius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fill();
    ctx.closePath();
  }
}
