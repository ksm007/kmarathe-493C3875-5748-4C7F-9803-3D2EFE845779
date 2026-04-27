import { LoginResponse, Role } from '@nx-temp/data';
import { AuthenticatedUser } from '@nx-temp/auth';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { OrganizationEntity, UserEntity } from '../database/entities';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    });

    return {
      accessToken,
      user: this.toCurrentUser(user),
    };
  }

  async register(
    email: string,
    fullName: string,
    password: string,
    organizationName: string
  ): Promise<LoginResponse> {
    const existing = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const slug = this.toSlug(organizationName);
    const slugExists = await this.organizationsRepository.findOne({ where: { slug } });
    if (slugExists) {
      throw new ConflictException('An organization with a similar name already exists');
    }

    const org = await this.organizationsRepository.save(
      this.organizationsRepository.create({
        name: organizationName,
        slug,
        parentOrganizationId: null,
        level: 1,
      })
    );

    const passwordHash = await bcrypt.hash(password, 10);
    const saved = await this.usersRepository.save(
      this.usersRepository.create({
        email: email.toLowerCase(),
        fullName,
        passwordHash,
        role: Role.Owner,
        organizationId: org.id,
      })
    );

    const user = await this.usersService.findById(saved.id);
    const accessToken = await this.jwtService.signAsync({
      sub: saved.id,
      role: saved.role,
      organizationId: saved.organizationId,
    });

    return { accessToken, user: this.toCurrentUser(user!) };
  }

  async validateJwtUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }

    return this.toCurrentUser(user);
  }

  getJwtConfig() {
    return {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      signOptions: {
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '8h'),
      },
    };
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private toCurrentUser(user: UserEntity): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as Role,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
    };
  }
}
