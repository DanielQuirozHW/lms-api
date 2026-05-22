import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Category } from '@prisma/client';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

const mockCategory: Category = { id: 'cat-1', name: 'Web Development', slug: 'web-development' };

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: jest.Mocked<
    Pick<
      CategoriesRepository,
      'findAll' | 'findById' | 'create' | 'update' | 'delete' | 'countCourses'
    >
  >;

  beforeEach(async () => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countCourses: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: CategoriesRepository, useValue: repo }],
    }).compile();

    service = module.get(CategoriesService);
  });

  describe('findAll', () => {
    it('should return all categories mapped to response DTOs', async () => {
      repo.findAll.mockResolvedValue([mockCategory]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-1');
      expect(result[0].slug).toBe('web-development');
    });
  });

  describe('create', () => {
    it('should create a category and auto-generate the slug', async () => {
      repo.create.mockResolvedValue(mockCategory);

      const result = await service.create({ name: 'Web Development' });

      expect(repo.create).toHaveBeenCalledWith({
        name: 'Web Development',
        slug: 'web-development',
      });
      expect(result.slug).toBe('web-development');
    });

    it('should generate slug with hyphens for multi-word names', async () => {
      const category: Category = { id: 'cat-2', name: 'Data Science', slug: 'data-science' };
      repo.create.mockResolvedValue(category);

      const result = await service.create({ name: 'Data Science' });

      expect(repo.create).toHaveBeenCalledWith({ name: 'Data Science', slug: 'data-science' });
      expect(result.slug).toBe('data-science');
    });
  });

  describe('update', () => {
    it('should update name and regenerate slug', async () => {
      const updated: Category = { id: 'cat-1', name: 'Frontend Dev', slug: 'frontend-dev' };
      repo.findById.mockResolvedValue(mockCategory);
      repo.update.mockResolvedValue(updated);

      const result = await service.update('cat-1', { name: 'Frontend Dev' });

      expect(repo.update).toHaveBeenCalledWith('cat-1', {
        name: 'Frontend Dev',
        slug: 'frontend-dev',
      });
      expect(result.slug).toBe('frontend-dev');
    });

    it('should throw NotFoundException when category does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update('cat-1', { name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete a category with no courses', async () => {
      repo.findById.mockResolvedValue(mockCategory);
      repo.countCourses.mockResolvedValue(0);
      repo.delete.mockResolvedValue(undefined);

      await expect(service.delete('cat-1')).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith('cat-1');
    });

    it('should throw ConflictException when category has courses assigned', async () => {
      repo.findById.mockResolvedValue(mockCategory);
      repo.countCourses.mockResolvedValue(3);

      await expect(service.delete('cat-1')).rejects.toThrow(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.delete('cat-1')).rejects.toThrow(NotFoundException);
    });
  });
});
