import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente) private clientesRepository: Repository<Cliente>,
  ) {}

  async create(createClienteDto: CreateClienteDto): Promise<Cliente> {
    const cliente = this.clientesRepository.create({
      nombres: createClienteDto.nombres.trim(),
      apellidos: createClienteDto.apellidos ? createClienteDto.apellidos.trim() : null,
      direccion: createClienteDto.direccion ? createClienteDto.direccion.trim() : null,
      telefono: createClienteDto.telefono ? createClienteDto.telefono.trim() : null,
      email: createClienteDto.email ? createClienteDto.email.trim() : null,
    });
    return this.clientesRepository.save(cliente);
  }

  async findAll(): Promise<Cliente[]> {
    return await this.clientesRepository.find();
  }

  async findOne(id: number): Promise<Cliente> {
    const existe = await this.clientesRepository.findOneBy({ id });
    if (!existe) {
      throw new NotFoundException(`el cliente con el id ${id} no existe`);
    }
    return existe;
  }

  async update(
    id: number,
    updateClienteDto: UpdateClienteDto,
  ): Promise<Cliente> {
    const cliente = await this.findOne(id);

    Object.assign(cliente, updateClienteDto);
    return this.clientesRepository.save(cliente);
  }

  async remove(id: number) {
    const cliente = await this.findOne(id);
    await this.clientesRepository.softRemove(cliente);
    return {
      message: 'Cliente eliminado exitosamente',
      cliente,
    };
  }
}
