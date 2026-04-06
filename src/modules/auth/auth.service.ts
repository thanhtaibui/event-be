import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserResponseDto } from '../user/dto/users.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
@Injectable()
export class AuthService {
    constructor(private jwtService: JwtService, @InjectRepository(User) private userRepo: Repository<User>) { }
    async login(loginDto: LoginDto): Promise<ApiResponse<any>> {
        const { email, password } = loginDto;

        const user = await this.userRepo.findOne({
            where: { email },
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            throw new BadRequestException('Wrong password');
        }

        const payload = {
            sub: user.id,
            email: user.email,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            statusCode: 200,
            message: 'Login successful',
            data: {
                accessToken,
            },
        };

    }
}
