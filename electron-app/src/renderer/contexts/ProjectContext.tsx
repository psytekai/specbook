import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Project, Product } from '../types';
import { api } from '../services/api';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  products: Product[];
}

type ProjectAction =
  | { type: 'LOAD_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'SELECT_PROJECT'; payload: string | null }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'LOAD_PRODUCTS'; payload: Product[] };

interface ProjectContextType extends ProjectState {
  dispatch: React.Dispatch<ProjectAction>;
  createProject: (name: string) => void;
  updateProject: (id: string, name: string) => void;
  selectProject: (id: string | null) => void;
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  refreshProjects: () => Promise<void>;
}

const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  products: [],
};

const ProjectContext = createContext<ProjectContextType | null>(null);

const projectReducer = (state: ProjectState, action: ProjectAction): ProjectState => {
  switch (action.type) {
    case 'LOAD_PROJECTS':
      return { ...state, projects: action.payload };
    
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => 
          p.id === action.payload.id ? action.payload : p
        ),
        currentProject: state.currentProject?.id === action.payload.id 
          ? action.payload 
          : state.currentProject
      };
    
    case 'SELECT_PROJECT':
      return {
        ...state,
        currentProject: action.payload 
          ? state.projects.find(p => p.id === action.payload) || null
          : null
      };
    
    case 'ADD_PRODUCT':
      return { ...state, products: [...state.products, action.payload] };
    
    case 'LOAD_PRODUCTS':
      return { ...state, products: action.payload };
    
    default:
      return state;
  }
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  // Load projects from API on mount, fallback to localStorage
  useEffect(() => {
    const loadProjects = async () => {
      try {
        // Try to load from API first (for mock data)
        const response = await api.get<Project[]>('/api/projects');
        dispatch({ type: 'LOAD_PROJECTS', payload: response.data });
        
        // Check for saved current project
        const savedCurrentProjectId = localStorage.getItem('currentProjectId');
        if (savedCurrentProjectId) {
          dispatch({ type: 'SELECT_PROJECT', payload: savedCurrentProjectId });
        }
      } catch (error) {
        console.warn('Failed to load projects from API, trying localStorage:', error);
        
        // Fallback to localStorage
        const savedProjects = localStorage.getItem('projects');
        const savedCurrentProjectId = localStorage.getItem('currentProjectId');
        
        if (savedProjects) {
          const projects = JSON.parse(savedProjects);
          dispatch({ type: 'LOAD_PROJECTS', payload: projects });
          
          if (savedCurrentProjectId) {
            dispatch({ type: 'SELECT_PROJECT', payload: savedCurrentProjectId });
          }
        }
      }
      
      // Load saved products from localStorage (for user-added products)
      const savedProducts = localStorage.getItem('products');
      if (savedProducts) {
        dispatch({ type: 'LOAD_PRODUCTS', payload: JSON.parse(savedProducts) });
      }
    };
    
    loadProjects();
  }, []);

  // Persist projects to localStorage
  useEffect(() => {
    localStorage.setItem('projects', JSON.stringify(state.projects));
  }, [state.projects]);

  // Persist current project ID
  useEffect(() => {
    if (state.currentProject) {
      localStorage.setItem('currentProjectId', state.currentProject.id);
    } else {
      localStorage.removeItem('currentProjectId');
    }
  }, [state.currentProject]);

  // Persist products
  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(state.products));
  }, [state.products]);

  const createProject = (name: string) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      productCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dispatch({ type: 'ADD_PROJECT', payload: newProject });
  };

  const updateProject = (id: string, name: string) => {
    const project = state.projects.find(p => p.id === id);
    if (project) {
      dispatch({
        type: 'UPDATE_PROJECT',
        payload: { ...project, name, updatedAt: new Date() }
      });
    }
  };

  const selectProject = (id: string | null) => {
    dispatch({ type: 'SELECT_PROJECT', payload: id });
  };

  const addProduct = (productData: Omit<Product, 'id' | 'createdAt'>) => {
    const newProduct: Product = {
      ...productData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    dispatch({ type: 'ADD_PRODUCT', payload: newProduct });
    
    // Update product count for the project
    const project = state.projects.find(p => p.id === productData.projectId);
    if (project) {
      const productCount = state.products.filter(p => p.projectId === project.id).length + 1;
      dispatch({
        type: 'UPDATE_PROJECT',
        payload: { ...project, productCount, updatedAt: new Date() }
      });
    }
  };

  const refreshProjects = async () => {
    try {
      const response = await api.get<Project[]>('/api/projects');
      dispatch({ type: 'LOAD_PROJECTS', payload: response.data });
    } catch (error) {
      console.warn('Failed to refresh projects from API:', error);
    }
  };

  return (
    <ProjectContext.Provider 
      value={{ 
        ...state, 
        dispatch, 
        createProject, 
        updateProject, 
        selectProject,
        addProduct,
        refreshProjects 
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};