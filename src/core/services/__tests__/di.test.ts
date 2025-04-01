import { DIContainer } from "../di";

describe('DIContainer', () => {
  describe('service registration and resolution', () => {
    // 基本服务注册和获取测试
    it('should register and resolve a simple service', async () => {
      // Arrange
      class SimpleService {
        static readonly serviceId = 'simple';
        getValue() {
          return 'simple value';
        }
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(SimpleService.serviceId, {
        factory: SimpleService,
        dependencies: []
      });
      
      const service = await container.get<SimpleService>(SimpleService.serviceId);
      
      // Assert
      expect(service).toBeInstanceOf(SimpleService);
      expect(service.getValue()).toBe('simple value');
    });
    
    // 测试带有非服务参数的服务
    it('should register and resolve a service with non-service parameters', async () => {
      // Arrange
      class ConfiguredService {
        static readonly serviceId = 'configured';
        
        constructor(private config: string, private enabled: boolean) {}
        
        getConfig() {
          return { config: this.config, enabled: this.enabled };
        }
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(ConfiguredService.serviceId, {
        factory: ConfiguredService,
        dependencies: ['config-value', true]
      });
      
      const service = await container.get<ConfiguredService>(ConfiguredService.serviceId);
      
      // Assert
      expect(service).toBeInstanceOf(ConfiguredService);
      expect(service.getConfig()).toEqual({ config: 'config-value', enabled: true });
    });
    
    // 测试服务依赖
    it('should register and resolve services with dependencies', async () => {
      // Arrange
      class LoggerService {
        static readonly serviceId = 'logger';
        
        log(message: string) {
          return `LOG: ${message}`;
        }
      }
      
      class UserService {
        static readonly serviceId = 'user';
        constructor(private logger: LoggerService) {}
        
        getUserInfo() {
          return this.logger.log('User info requested');
        }
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(LoggerService.serviceId, {
        factory: LoggerService,
        dependencies: []
      });
      
      container.register(UserService.serviceId, {
        factory: UserService,
        dependencies: [DIContainer.service(LoggerService)]
      });
      
      const userService = await container.get<UserService>(UserService.serviceId);
      
      // Assert
      expect(userService).toBeInstanceOf(UserService);
      expect(userService.getUserInfo()).toBe('LOG: User info requested');
    });
    
    // 测试多重依赖
    it('should handle multiple levels of service dependencies', async () => {
      // Arrange
      class DatabaseService {
        static readonly serviceId = 'database';
        query(sql: string) {
          return `Result for: ${sql}`;
        }
      }
      
      class RepositoryService {
        static readonly serviceId = 'repository';
        constructor(private db: DatabaseService) {}
        
        findAll() {
          return this.db.query('SELECT * FROM items');
        }
      }
      
      class ControllerService {
        static readonly serviceId = 'controller';
        constructor(private repository: RepositoryService) {}
        
        getItems() {
          return this.repository.findAll();
        }
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(DatabaseService.serviceId, {
        factory: DatabaseService,
        dependencies: []
      });
      
      container.register(RepositoryService.serviceId, {
        factory: RepositoryService,
        dependencies: [DIContainer.service(DatabaseService)]
      });
      
      container.register(ControllerService.serviceId, {
        factory: ControllerService,
        dependencies: [DIContainer.service(RepositoryService)]
      });
      
      const controller = await container.get<ControllerService>(ControllerService.serviceId);
      
      // Assert
      expect(controller).toBeInstanceOf(ControllerService);
      expect(controller.getItems()).toBe('Result for: SELECT * FROM items');
    });
    
    // 测试混合依赖（服务和非服务参数）
    it('should handle mixed dependencies (services and non-service parameters)', async () => {
      // Arrange
      class LoggerService {
        static readonly serviceId = 'logger';
        
        log(message: string) {
          return `LOG: ${message}`;
        }
      }
      
      class ApiService {
        static readonly serviceId = 'api';
        constructor(
          private logger: LoggerService,
          private baseUrl: string,
          private timeout: number
        ) {}
        
        request(endpoint: string) {
          return {
            url: `${this.baseUrl}/${endpoint}`,
            timeout: this.timeout,
            log: this.logger.log(`Request to ${endpoint}`)
          };
        }
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(LoggerService.serviceId, {
        factory: LoggerService,
        dependencies: []
      });
      
      container.register(ApiService.serviceId, {
        factory: ApiService,
        dependencies: [
          DIContainer.service(LoggerService),
          'https://api.example.com',
          5000
        ]
      });
      
      const apiService = await container.get<ApiService>(ApiService.serviceId);
      
      // Assert
      expect(apiService).toBeInstanceOf(ApiService);
      const result = apiService.request('users');
      expect(result.url).toBe('https://api.example.com/users');
      expect(result.timeout).toBe(5000);
      expect(result.log).toBe('LOG: Request to users');
    });
    
    // 测试单例服务
    it('should return the same instance for singleton services', async () => {
      // Arrange
      class SingletonService {
        static readonly serviceId = 'singleton';
        counter = 0;
        
        increment() {
          return ++this.counter;
        }
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(SingletonService.serviceId, {
        factory: SingletonService,
        dependencies: [],
        singleton: true
      });
      
      const instance1 = await container.get<SingletonService>(SingletonService.serviceId);
      instance1.increment();
      
      const instance2 = await container.get<SingletonService>(SingletonService.serviceId);
      
      // Assert
      expect(instance2).toBe(instance1); // 相同实例
      expect(instance2.counter).toBe(1); // 状态共享
    });
    
    // 测试非单例服务
    it('should return different instances for non-singleton services', async () => {
      // Arrange
      class TransientService {
        static readonly serviceId = 'transient';
        counter = 0;
        
        increment() {
          return ++this.counter;
        }
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(TransientService.serviceId, {
        factory: TransientService,
        dependencies: [],
        singleton: false
      });
      
      const instance1 = await container.get<TransientService>(TransientService.serviceId);
      instance1.increment();
      
      const instance2 = await container.get<TransientService>(TransientService.serviceId);
      
      // Assert
      expect(instance2).not.toBe(instance1); // 不同实例
      expect(instance2.counter).toBe(0); // 状态不共享
    });
    
    // 测试工厂函数
    it('should support factory functions for service creation', async () => {
      // Arrange
      interface Config {
        apiKey: string;
      }
      
      class ConfigService {
        static readonly serviceId = 'config';
        getConfig(): Config {
          return { apiKey: 'test-key' };
        }
      }
      
      class ApiClient {
        static readonly serviceId = 'apiClient';
        constructor(public readonly apiKey: string) {}
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(ConfigService.serviceId, {
        factory: ConfigService,
        dependencies: []
      });
      
      container.register(ApiClient.serviceId, {
        factory: (configService: ConfigService) => {
          const config = configService.getConfig();
          return new ApiClient(config.apiKey);
        },
        dependencies: [DIContainer.service(ConfigService)]
      });
      
      const apiClient = await container.get<ApiClient>(ApiClient.serviceId);
      
      // Assert
      expect(apiClient).toBeInstanceOf(ApiClient);
      expect(apiClient.apiKey).toBe('test-key');
    });
    
    // 测试异步工厂函数
    it('should support async factory functions', async () => {
      // Arrange
      class AsyncService {
        static readonly serviceId = 'async';
        constructor(public value: string) {}
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(AsyncService.serviceId, {
        factory: async () => {
          // 模拟异步操作
          return new Promise<AsyncService>(resolve => {
            setTimeout(() => {
              resolve(new AsyncService('async-value'));
            }, 10);
          });
        },
        dependencies: []
      });
      
      const asyncService = await container.get<AsyncService>(AsyncService.serviceId);
      
      // Assert
      expect(asyncService).toBeInstanceOf(AsyncService);
      expect(asyncService.value).toBe('async-value');
    });
    
    // 测试循环依赖检测
    it('should detect circular dependencies during registration', () => {
      // Arrange
      class ServiceA {
        static readonly serviceId = 'serviceA';
        constructor(public serviceB: any) {}
      }
      
      class ServiceB {
        static readonly serviceId = 'serviceB';
        constructor(public serviceC: any) {}
      }
      
      class ServiceC {
        static readonly serviceId = 'serviceC';
        constructor(public serviceA: any) {}
      }
      
      const container = new DIContainer();
      
      // Act & Assert
      container.register(ServiceA.serviceId, {
        factory: ServiceA,
        dependencies: [DIContainer.service(ServiceB)]
      });
      
      container.register(ServiceB.serviceId, {
        factory: ServiceB,
        dependencies: [DIContainer.service(ServiceC)]
      });
      
      // 注册ServiceC应该抛出循环依赖错误
      expect(() => {
        container.register(ServiceC.serviceId, {
          factory: ServiceC,
          dependencies: [DIContainer.service(ServiceA)]
        });
      }).toThrow(/Circular dependency detected/);
    });
    
    // 测试未注册服务依赖
    it('should throw when a service depends on an unregistered service', async () => {
      // Arrange
      class DependentService {
        static readonly serviceId = 'dependent';
        constructor(public dependency: any) {}
      }
      
      const container = new DIContainer();
      
      // Act & Assert
      // 注册时不会抛出错误，但获取时会
      container.register(DependentService.serviceId, {
        factory: DependentService,
        dependencies: [DIContainer.service({ serviceId: 'nonexistent' })]
      });
      
      // 获取服务时应该抛出错误
      await expect(container.get(DependentService.serviceId)).rejects.toThrow(/depends on unregistered service/);
    });
    
    // 测试服务更新
    it('should allow updating a registered service', async () => {
      // Arrange
      class VersionedService {
        static readonly serviceId = 'versioned';
        constructor(public version: string) {}
      }
      
      const container = new DIContainer();
      
      // Act
      container.register(VersionedService.serviceId, {
        factory: VersionedService,
        dependencies: ['v1']
      });
      
      const v1 = await container.get<VersionedService>(VersionedService.serviceId);
      
      // 更新服务
      container.update(VersionedService.serviceId, {
        factory: VersionedService,
        dependencies: ['v2']
      });
      
      const v2 = await container.get<VersionedService>(VersionedService.serviceId);
      
      // Assert
      expect(v1.version).toBe('v1');
      expect(v2.version).toBe('v2');
      expect(v1).not.toBe(v2); // 应该是不同的实例
    });
    
    // 测试service静态方法
    it('should create a service dependency reference with the correct serviceId', () => {
      // Arrange
      const serviceId = 'testService';
      
      // Act
      const result = DIContainer.service({ serviceId });
      
      // Assert
      expect(result).toEqual({ serviceId: 'testService' });
    });
  });
});