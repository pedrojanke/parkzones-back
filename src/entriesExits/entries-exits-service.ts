/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Vehicle } from 'src/vehicles/entities/vehicle.entity';
import { Repository } from 'typeorm';
import { CreateEntryExitDto } from './dtos/create-entry-exit.dto';
import { UpdateEntryExitDto } from './dtos/update-entry-exit.dto';
import { EntryExit } from './entities/entry-exit.entity';

@Injectable()
export class EntriesExitsService {
  constructor(
    @InjectRepository(EntryExit)
    private readonly entryExitRepository: Repository<EntryExit>,

    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  async create(createEntryExitDto: CreateEntryExitDto): Promise<EntryExit> {
    const { vehicle_id, entry_time, exit_time } = createEntryExitDto;

    const vehicle = await this.vehicleRepository.findOneBy({
      id_vehicle: vehicle_id,
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const entryExit = this.entryExitRepository.create({
      vehicle,
      entry_time,
      exit_time,
      duration_minutes: exit_time
        ? this.calculateDuration(entry_time, exit_time)
        : null,
      charged_amount: exit_time
        ? this.calculateChargedAmount(entry_time, exit_time, vehicle) // Passa o veículo completo
        : null,
    });

    return this.entryExitRepository.save(entryExit);
  }

  async findAll(): Promise<EntryExit[]> {
    return this.entryExitRepository.find({ relations: ['vehicle'] });
  }

  async findOne(id_movement: string): Promise<EntryExit> {
    const entryExit = await this.entryExitRepository.findOne({
      where: { id_movement },
      relations: ['vehicle'],
    });

    if (!entryExit) {
      throw new NotFoundException(`EntryExit with ID ${id_movement} not found`);
    }

    return entryExit;
  }

  async update(
    id_movement: string,
    updateEntryExitDto: UpdateEntryExitDto,
  ): Promise<EntryExit> {
    const entryExit = await this.findOne(id_movement);
  
    Object.assign(entryExit, updateEntryExitDto);
  
    // Verifica se exit_time foi fornecido
    if (updateEntryExitDto.exit_time) {
      entryExit.duration_minutes = this.calculateDuration(
        entryExit.entry_time,
        updateEntryExitDto.exit_time,
      );
  
      // Usa a taxa do veículo para calcular o valor cobrado
      entryExit.charged_amount = this.calculateChargedAmount(
        entryExit.entry_time,
        updateEntryExitDto.exit_time,
        entryExit.vehicle // Passa o veículo associado
      );
    }
  
    return this.entryExitRepository.save(entryExit);
  }
  

  async delete(id_movement: string): Promise<void> {
    const result = await this.entryExitRepository.delete(id_movement);
    if (result.affected === 0) {
      throw new NotFoundException(`EntryExit with ID ${id_movement} not found`);
    }
  }

  public calculateDuration(entry_time: Date, exit_time: Date): number {
    const duration =
      (new Date(exit_time).getTime() - new Date(entry_time).getTime()) /
      1000 /
      60;
    return Math.max(0, Math.floor(duration));
  }

  public calculateChargedAmount(
    entry_time: Date,
    exit_time: Date,
    vehicle: Vehicle,
  ): number {
    const duration = this.calculateDuration(entry_time, exit_time);
    const hourlyRate = vehicle.rate.hourly_rate; // Usa a taxa do veículo
    return duration > 0 ? Math.ceil(duration / 60) * hourlyRate : 0;
  }

  async findActiveByPlate(license_plate: string): Promise<EntryExit | null> {
    const vehicleEntry = await this.entryExitRepository.findOne({
      where: {
        exit_time: null, // Verifica se o horário de saída é nulo
        vehicle: { license_plate }, // Filtra pelo campo da placa do veículo
      },
      relations: ['vehicle'],
    });

    return vehicleEntry || null;
  }
}
