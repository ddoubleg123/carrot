'use client';

import React from 'react';

const TestTailwind = () => {
  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-4">
        Tailwind CSS IntelliSense Test
      </h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2 text-gray-800">Test Components</h2>
          
          <button className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors">
            Hover Me
          </button>
          
          <div className="mt-4 p-3 bg-gray-50 border-l-4 border-primary">
            <p className="text-gray-700">
              If you see styled components and get IntelliSense when hovering or typing Tailwind classes, it's working!
            </p>
          </div>
          
          <div className="mt-4 flex space-x-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              Success
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              Working
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestTailwind;
