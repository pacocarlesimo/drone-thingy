import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DroneTrajectoryComponent } from './drone-trajectory.component';

describe('DroneTrajectoryComponent', () => {
  let component: DroneTrajectoryComponent;
  let fixture: ComponentFixture<DroneTrajectoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DroneTrajectoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DroneTrajectoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
