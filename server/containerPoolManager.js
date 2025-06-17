// server/containerPoolManager.js
import Docker from 'dockerode';
import { Meteor } from 'meteor/meteor';

export class ContainerPoolManager {
  constructor(options = {}) {
    this.docker = new Docker({ host: 'localhost', port: 2375 });
    this.pool = new Map(); // containerType -> container[]
    this.activeContainers = new Map(); // containerId -> containerInfo
    this.config = {
      minPoolSize: options.minPoolSize || 2,
      maxPoolSize: options.maxPoolSize || 10,
      maxIdleTime: options.maxIdleTime || 15 * 60 * 1000, // 15 minutes
      warmupContainers: options.warmupContainers || 3,
      ...options
    };
    
    this.initializePool();
    this.startMaintenanceJobs();
  }

  async initializePool() {
    console.log('Initializing container pool...');
    try {
      // Clean up any existing containers from previous runs
      await this.cleanupOrphanedContainers();
      
      // Pre-warm the pool with default containers
      await this.warmupPool('ssh-terminal', this.config.warmupContainers);
      
      console.log(`Container pool initialized with ${this.config.warmupContainers} containers`);
    } catch (error) {
      console.error('Failed to initialize container pool:', error);
    }
  }

  async getContainer(containerType = 'ssh-terminal', options = {}) {
    try {
      // Try to get from pool first
      const pooledContainer = await this.getFromPool(containerType);
      if (pooledContainer) {
        console.log(`Retrieved container from pool: ${pooledContainer.id.substring(0, 12)}`);
        return pooledContainer;
      }

      // Create new container if pool is empty
      console.log(`Pool empty, creating new container of type: ${containerType}`);
      return await this.createNewContainer(containerType, options);
    } catch (error) {
      console.error('Error getting container:', error);
      throw error;
    }
  }

  async getFromPool(containerType) {
    const typePool = this.pool.get(containerType) || [];
    
    if (typePool.length === 0) {
      return null;
    }

    // Get the first healthy container
    for (let i = 0; i < typePool.length; i++) {
      const container = typePool[i];
      const isHealthy = await this.checkContainerHealth(container);
      
      if (isHealthy) {
        // Remove from pool and add to active containers
        typePool.splice(i, 1);
        this.pool.set(containerType, typePool);
        
        const containerInfo = await this.prepareContainer(container);
        this.activeContainers.set(container.id, {
          ...containerInfo,
          assignedAt: new Date(),
          containerType
        });
        
        // Maintain pool size
        this.maintainPoolSize(containerType);
        
        return containerInfo;
      } else {
        // Remove unhealthy container
        typePool.splice(i, 1);
        await this.cleanupContainer(container);
        i--; // Adjust index after removal
      }
    }

    return null;
  }

  async createNewContainer(containerType, options = {}) {
    const containerConfig = this.getContainerConfig(containerType, options);
    
    try {
      console.log(`Creating new container: ${containerType}`);
      const container = await this.docker.createContainer(containerConfig);
      await container.start();
      
      // Wait for container to be ready
      await this.waitForContainerReady(container);
      
      const containerInfo = await this.prepareContainer(container);
      this.activeContainers.set(container.id, {
        ...containerInfo,
        assignedAt: new Date(),
        containerType
      });
      
      return containerInfo;
    } catch (error) {
      console.error(`Failed to create container ${containerType}:`, error);
      throw error;
    }
  }

  async prepareContainer(container) {
    const data = await container.inspect();
    const mapped = data?.NetworkSettings?.Ports?.['22/tcp'];
    
    if (!mapped || !mapped[0]?.HostPort) {
      throw new Error('Could not retrieve mapped HostPort for SSH container');
    }

    return {
      id: container.id,
      name: data.Name.replace('/', ''),
      host: 'localhost',
      port: parseInt(mapped[0].HostPort),
      status: 'ready',
      createdAt: new Date(data.Created)
    };
  }

  async releaseContainer(containerId, options = {}) {
    const containerInfo = this.activeContainers.get(containerId);
    if (!containerInfo) {
      console.warn(`Container ${containerId} not found in active containers`);
      return;
    }

    try {
      const container = this.docker.getContainer(containerId);
      
      if (options.terminate || !options.reuse) {
        // Terminate container
        await this.cleanupContainer(container);
        this.activeContainers.delete(containerId);
        console.log(`Container ${containerId.substring(0, 12)} terminated`);
      } else {
        // Return to pool for reuse
        await this.resetContainer(container);
        
        const containerType = containerInfo.containerType || 'ssh-terminal';
        const typePool = this.pool.get(containerType) || [];
        
        // Check pool size limit
        if (typePool.length < this.config.maxPoolSize) {
          typePool.push(container);
          this.pool.set(containerType, typePool);
          this.activeContainers.delete(containerId);
          console.log(`Container ${containerId.substring(0, 12)} returned to pool`);
        } else {
          // Pool is full, terminate container
          await this.cleanupContainer(container);
          this.activeContainers.delete(containerId);
          console.log(`Container ${containerId.substring(0, 12)} terminated (pool full)`);
        }
      }
    } catch (error) {
      console.error(`Error releasing container ${containerId}:`, error);
      this.activeContainers.delete(containerId);
    }
  }

  async resetContainer(container) {
    try {
      // Reset container to clean state
      await container.exec({
        Cmd: ['sh', '-c', 'pkill -f ".*" || true; history -c || true'],
        AttachStdout: false,
        AttachStderr: false
      });
      
      // Additional cleanup commands can be added here
      console.log(`Container ${container.id.substring(0, 12)} reset`);
    } catch (error) {
      console.error('Error resetting container:', error);
      // If reset fails, container will be terminated instead of reused
      throw error;
    }
  }

  async checkContainerHealth(container) {
    try {
      const data = await container.inspect();
      return data.State.Running && data.State.Health?.Status !== 'unhealthy';
    } catch (error) {
      return false;
    }
  }

  async waitForContainerReady(container, timeout = 30000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const data = await container.inspect();
        if (data.State.Running) {
          // Wait a bit more for SSH to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          return true;
        }
      } catch (error) {
        // Container might not be ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Container failed to become ready within ${timeout}ms`);
  }

  getContainerConfig(containerType, options = {}) {
    const baseConfig = {
      Image: options.image || 'ssh-terminal',
      name: `${containerType}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      Tty: true,
      ExposedPorts: { '22/tcp': {} },
      HostConfig: { 
        PortBindings: { '22/tcp': [{}] },
        Memory: options.memory || 512 * 1024 * 1024, // 512MB
        CpuShares: options.cpuShares || 512
      },
      Labels: {
        'ssh-terminal.managed': 'true',
        'ssh-terminal.type': containerType,
        'ssh-terminal.created': new Date().toISOString()
      }
    };

    // Add environment variables if specified
    if (options.env) {
      baseConfig.Env = Object.entries(options.env).map(([key, value]) => `${key}=${value}`);
    }

    return baseConfig;
  }

  async maintainPoolSize(containerType) {
    const typePool = this.pool.get(containerType) || [];
    const needed = this.config.minPoolSize - typePool.length;
    
    if (needed > 0) {
      console.log(`Maintaining pool: creating ${needed} containers of type ${containerType}`);
      
      const createPromises = Array(needed).fill().map(() => 
        this.createPoolContainer(containerType)
      );
      
      await Promise.allSettled(createPromises);
    }
  }

  async createPoolContainer(containerType) {
    try {
      const containerConfig = this.getContainerConfig(containerType);
      const container = await this.docker.createContainer(containerConfig);
      await container.start();
      await this.waitForContainerReady(container);
      
      const typePool = this.pool.get(containerType) || [];
      typePool.push(container);
      this.pool.set(containerType, typePool);
      
      console.log(`Pool container created: ${container.id.substring(0, 12)}`);
    } catch (error) {
      console.error(`Failed to create pool container ${containerType}:`, error);
    }
  }

  async warmupPool(containerType, count) {
    console.log(`Warming up pool with ${count} ${containerType} containers`);
    
    const createPromises = Array(count).fill().map(() => 
      this.createPoolContainer(containerType)
    );
    
    const results = await Promise.allSettled(createPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`Pool warmup completed: ${successful}/${count} containers created`);
  }

  async cleanupContainer(container) {
    try {
      await container.stop({ t: 10 }); // 10 second timeout
      await container.remove();
    } catch (error) {
      console.error('Error cleaning up container:', error);
      // Force remove if stop fails
      try {
        await container.remove({ force: true });
      } catch (forceError) {
        console.error('Error force removing container:', forceError);
      }
    }
  }

  async cleanupOrphanedContainers() {
    try {
      const containers = await this.docker.listContainers({ 
        all: true,
        filters: { label: ['ssh-terminal.managed=true'] }
      });

      console.log(`Found ${containers.length} managed containers to clean up`);
      
      for (const containerInfo of containers) {
        try {
          const container = this.docker.getContainer(containerInfo.Id);
          await container.stop({ t: 5 });
          await container.remove();
          console.log(`Cleaned up orphaned container: ${containerInfo.Id.substring(0, 12)}`);
        } catch (error) {
          console.error(`Failed to cleanup container ${containerInfo.Id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error cleaning up orphaned containers:', error);
    }
  }

  startMaintenanceJobs() {
    // Pool maintenance job - every 5 minutes
    Meteor.setInterval(async () => {
      await this.maintainPools();
    }, 5 * 60 * 1000);

    // Idle container cleanup - every 10 minutes
    Meteor.setInterval(async () => {
      await this.cleanupIdleContainers();
    }, 10 * 60 * 1000);

    // Health check - every 2 minutes
    Meteor.setInterval(async () => {
      await this.healthCheckPools();
    }, 2 * 60 * 1000);
  }

  async maintainPools() {
    try {
      for (const [containerType] of this.pool) {
        await this.maintainPoolSize(containerType);
      }
      
      // Ensure default pool exists
      if (!this.pool.has('ssh-terminal')) {
        await this.maintainPoolSize('ssh-terminal');
      }
    } catch (error) {
      console.error('Error in pool maintenance:', error);
    }
  }

  async cleanupIdleContainers() {
    try {
      const now = Date.now();
      const containersToRemove = [];

      // Check active containers for idle timeout
      for (const [containerId, containerInfo] of this.activeContainers) {
        const idleTime = now - containerInfo.assignedAt.getTime();
        if (idleTime > this.config.maxIdleTime) {
          containersToRemove.push(containerId);
        }
      }

      // Remove idle containers
      for (const containerId of containersToRemove) {
        console.log(`Removing idle container: ${containerId.substring(0, 12)}`);
        await this.releaseContainer(containerId, { terminate: true });
      }

      // Check pool containers for excessive idle time
      for (const [containerType, typePool] of this.pool) {
        const excessContainers = Math.max(0, typePool.length - this.config.minPoolSize);
        if (excessContainers > 0) {
          console.log(`Removing ${excessContainers} excess containers from ${containerType} pool`);
          
          for (let i = 0; i < excessContainers; i++) {
            const container = typePool.pop();
            if (container) {
              await this.cleanupContainer(container);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in idle container cleanup:', error);
    }
  }

  async healthCheckPools() {
    try {
      for (const [containerType, typePool] of this.pool) {
        const healthyContainers = [];
        
        for (const container of typePool) {
          const isHealthy = await this.checkContainerHealth(container);
          if (isHealthy) {
            healthyContainers.push(container);
          } else {
            console.log(`Removing unhealthy container from ${containerType} pool`);
            await this.cleanupContainer(container);
          }
        }
        
        this.pool.set(containerType, healthyContainers);
      }
    } catch (error) {
      console.error('Error in pool health check:', error);
    }
  }

  getPoolStats() {
    const stats = {
      pools: {},
      activeContainers: this.activeContainers.size,
      totalPooled: 0
    };

    for (const [containerType, typePool] of this.pool) {
      stats.pools[containerType] = {
        available: typePool.length,
        minSize: this.config.minPoolSize,
        maxSize: this.config.maxPoolSize
      };
      stats.totalPooled += typePool.length;
    }

    stats.memoryUsage = process.memoryUsage();
    
    return stats;
  }

  async shutdown() {
    console.log('Shutting down container pool manager...');
    
    try {
      // Clean up all active containers
      const activeCleanup = Array.from(this.activeContainers.keys()).map(containerId =>
        this.releaseContainer(containerId, { terminate: true })
      );
      
      // Clean up all pooled containers
      const poolCleanup = [];
      for (const [containerType, typePool] of this.pool) {
        poolCleanup.push(...typePool.map(container => this.cleanupContainer(container)));
      }
      
      await Promise.allSettled([...activeCleanup, ...poolCleanup]);
      
      this.activeContainers.clear();
      this.pool.clear();
      
      console.log('Container pool manager shutdown complete');
    } catch (error) {
      console.error('Error during container pool shutdown:', error);
    }
  }
}