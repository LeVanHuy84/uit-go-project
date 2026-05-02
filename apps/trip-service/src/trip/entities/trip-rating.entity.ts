import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Trip } from './trip.entity';

@Entity('trip_ratings')
export class TripRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tripId: string;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: 'tripId' })
  trip: Trip;

  @Column()
  driverId: string;

  @Column()
  passengerId: string;

  @Column({ type: 'int', width: 1 })
  rating: number;

  @Column({ nullable: true })
  feedback?: string;

  @CreateDateColumn()
  createdAt: Date;
}
