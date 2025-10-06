import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TripStatus } from '@repo/share-dto';

@Entity()
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  passengerId: string;

  @Column({ nullable: true })
  driverId: string;

  @Column({
    type: 'enum',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    enum: TripStatus,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    default: TripStatus.CREATING,
  })
  status: TripStatus;

  @Column('jsonb', { nullable: true })
  pickupLocation: any;

  @Column('jsonb', { nullable: true })
  dropOffLocation: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
