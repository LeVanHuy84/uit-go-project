import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TripStatus, VehicleType } from '@repo/shared';

@Entity()
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  passengerId: string;

  @Column({ nullable: true })
  driverId: string;

  @Column( { type: 'enum', enum: VehicleType, default: VehicleType.MOTORBIKE })
  vehicleType: VehicleType

  @Column('float')
  originLat: number;

  @Column('float')
  originLng: number;

  @Column('float')
  destinationLat: number;

  @Column('float')
  destinationLng: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  estimatedFare: number;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.SEARCHING })
  status: TripStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
